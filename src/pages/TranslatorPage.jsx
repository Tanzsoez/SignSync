import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, Mic, MicOff, RefreshCw, Volume2, Sparkles, CheckCircle2, Shield, ListChecks, X } from 'lucide-react';
import { useModel } from '../contexts/ModelContext';
import { DynamicGestureTracker, refineFingerspellingPrediction } from '../utils/dynamicGestureEngine';
import {
  predictDynamicSequence,
  predictStatic,
  SequenceRingBuffer,
} from '../utils/sequenceInference';
import { DynamicGestureSegmenter } from '../utils/dynamicGestureSegmenter';
import { loadHolistic } from '../utils/loadHolistic';
import {
  HolisticTrackingStabilizer,
  isFreshHolisticResult,
  selectActiveHandObjects,
} from '../utils/holisticTracking';
import { cameraConstraints, getRuntimeProfile } from '../utils/runtimeProfile';
import { GestureRejectionGate, isIsolatedMiddleFingerGesture } from '../utils/gestureSafety';
import { createSignSequence } from '../utils/textToSign';

const DYNAMIC_HOLD_MS = 900;
const TRANSLATOR_GUIDANCE_SESSION_KEY = 'signsync_translator_guidance_seen';
const Hand3D = lazy(() => import('../components/Hand3D'));

import { DATASET_CATALOG, getCatalogDisplay, getCatalogSpokenText } from '../data/signCatalog';

const getHumanReadableSign = getCatalogDisplay;
const getSpokenSignText = getCatalogSpokenText;

const dist3D = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow((p1.z || 0) - (p2.z || 0), 2));

const extractFeatures72 = (pts) => {
  if (!pts || pts.length < 21) return null;
  const wrist = pts[0];
  const palmScale = dist3D(wrist, pts[9]) || 1.0;

  const liveFeatures = [];
  for (let i = 1; i <= 20; i++) {
    liveFeatures.push(
      Number(((pts[i].x - wrist.x) / palmScale).toFixed(4)),
      Number(((pts[i].y - wrist.y) / palmScale).toFixed(4)),
      Number((((pts[i].z || 0) - (wrist.z || 0)) / palmScale).toFixed(4))
    );
  }

  liveFeatures.push(
    Number((dist3D(pts[4], pts[8]) / palmScale).toFixed(4)),
    Number((dist3D(pts[4], pts[12]) / palmScale).toFixed(4)),
    Number((dist3D(pts[4], pts[16]) / palmScale).toFixed(4)),
    Number((dist3D(pts[4], pts[20]) / palmScale).toFixed(4)),
    Number((dist3D(pts[8], pts[12]) / palmScale).toFixed(4)),
    Number((dist3D(pts[12], pts[16]) / palmScale).toFixed(4)),
    Number((dist3D(pts[16], pts[20]) / palmScale).toFixed(4)),
    Number((dist3D(pts[4], pts[5]) / palmScale).toFixed(4)),
    Number((dist3D(pts[4], pts[6]) / palmScale).toFixed(4)),
    Number((dist3D(pts[4], pts[10]) / palmScale).toFixed(4)),
    Number((dist3D(pts[4], pts[14]) / palmScale).toFixed(4)),
    Number((dist3D(pts[4], pts[18]) / palmScale).toFixed(4))
  );

  return liveFeatures.length === 72 ? liveFeatures : null;
};

const extractDynamicFeaturesV2 = (rightHand, leftHand, pose) => {
  if (!pose?.[11] || !pose?.[12] || (!rightHand && !leftHand)) return null;
  const leftShoulder = pose[11];
  const rightShoulder = pose[12];
  const center = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: ((leftShoulder.z || 0) + (rightShoulder.z || 0)) / 2,
  };
  const scale = Math.max(0.08, dist3D(leftShoulder, rightShoulder));
  const body = (point) => point
    ? [(point.x - center.x) / scale, (point.y - center.y) / scale, ((point.z || 0) - center.z) / scale]
    : [0, 0, 0];
  const shape = (hand) => extractFeatures72(hand) || Array(72).fill(0);
  const rightWrist = rightHand?.[0];
  const leftWrist = leftHand?.[0];
  const nose = pose[0] || center;
  const chin = { x: nose.x, y: nose.y + 0.08, z: nose.z || 0 };
  const chest = { x: center.x, y: center.y + 0.12, z: center.z };
  const anchorDistances = (wrist) => wrist
    ? [dist3D(wrist, nose) / scale, dist3D(wrist, chin) / scale, dist3D(wrist, chest) / scale]
    : [0, 0, 0];
  const wristPair = (rightWrist && leftWrist)
    ? [
      (rightWrist.x - leftWrist.x) / scale,
      (rightWrist.y - leftWrist.y) / scale,
      ((rightWrist.z || 0) - (leftWrist.z || 0)) / scale,
      dist3D(rightWrist, leftWrist) / scale,
    ]
    : [0, 0, 0, 0];
  const features = [
    ...shape(rightHand), ...shape(leftHand),
    ...body(rightWrist), ...body(leftWrist),
    ...body(rightHand?.[8]), ...body(leftHand?.[8]),
    rightHand ? 1 : 0, leftHand ? 1 : 0,
    ...anchorDistances(rightWrist), ...anchorDistances(leftWrist), ...wristPair,
  ].map((value) => Number(value.toFixed(4)));
  return features.length === 168 ? features : null;
};

// Calculate landmark variance across frames to detect deliberate physical gesture motion
// Physical Characteristics & Biomechanical Traits Validator
// Strictly validates all 44 dynamic conversational phrases (21 ASL + 23 FSL) against
// handshape posture, body zone anchor, and finger extensions per the user's dataset guide.
// Any candidate that violates its physical characteristics is strictly rejected.
export default function TranslatorPage() {
  const { staticModel, staticMetadata, dynamicModel, dynamicMetadata } = useModel();

  const [activeSubTab, setActiveSubTab] = useState('sign-to-text'); // 'sign-to-text' | 'speech-to-sign'
  const [language, setLanguage] = useState(() => localStorage.getItem('signsync_dialect') || localStorage.getItem('signsync_lang') || 'ASL'); // 'ASL' | 'FSL'
  const [signMode, setSignMode] = useState(() => localStorage.getItem('signsync_sign_mode') || 'fingerspelling'); // 'fingerspelling' | 'phrases'
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(() => {
    try {
      return window.sessionStorage.getItem(TRANSLATOR_GUIDANCE_SESSION_KEY) !== 'seen';
    } catch {
      return true;
    }
  });
  const signModeRef = useRef(signMode);

  const dismissGuidance = useCallback(() => {
    try {
      window.sessionStorage.setItem(TRANSLATOR_GUIDANCE_SESSION_KEY, 'seen');
    } catch {
      // Private browsing can reject session storage; closing still works.
    }
    setIsGuidanceOpen(false);
  }, []);

  const openSettingsGuidance = () => {
    dismissGuidance();
    window.location.hash = 'settings';
  };

  useEffect(() => {
    if (!isGuidanceOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismissGuidance();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isGuidanceOpen, dismissGuidance]);

  // Sync language selection from localStorage / SettingsPage
  useEffect(() => {
    const syncLang = () => {
      const savedLang = localStorage.getItem('signsync_dialect') || localStorage.getItem('signsync_lang') || 'ASL';
      setLanguage(savedLang);
    };

    window.addEventListener('storage', syncLang);
    window.addEventListener('signsync_lang_change', syncLang);
    return () => {
      window.removeEventListener('storage', syncLang);
      window.removeEventListener('signsync_lang_change', syncLang);
    };
  }, []);

  const handleDialectChange = (newLang) => {
    setLanguage(newLang);
    localStorage.setItem('signsync_dialect', newLang);
    localStorage.setItem('signsync_lang', newLang);
    window.dispatchEvent(new Event('signsync_lang_change'));
    const result = createSignSequence(inputMessage, newLang);
    setSignSequence(result.unsupported.length ? [] : result.sequence);
    setCurrentSequenceIndex(0);
    setCurrentAnimatingWord(result.unsupported.length || !result.sequence.length ? 'NONE' : result.sequence[0].key);
    setTranslationNotice(result.unsupported.length
      ? `The current text is not fully supported by the trained ${newLang} catalog.`
      : '');
    setAnimationToken((value) => value + 1);
  };

  // Sign-to-Text States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [translatedText, setTranslatedText] = useState('Hello! Place your hand in camera view.');
  const [detectedSign, setDetectedSign] = useState('NONE');
  const [confidence, setConfidence] = useState(0);
  const [isSignLocked, setIsSignLocked] = useState(false);
  const [handPostureStatus, setHandPostureStatus] = useState('Loading MediaPipe AI Engine...');
  // Speech/Text-to-Sign States
  const [inputMessage, setInputMessage] = useState('Hello');
  const [currentAnimatingWord, setCurrentAnimatingWord] = useState('Hello');
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('Click microphone to speak');
  const [translationNotice, setTranslationNotice] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [signSequence, setSignSequence] = useState([
    { key: 'HELLO', label: 'Hello', type: 'phrase', durationMs: 2850 },
  ]);
  const [currentSequenceIndex, setCurrentSequenceIndex] = useState(0);
  const [animationToken, setAnimationToken] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const holisticRef = useRef(null);
  const holisticStabilizerRef = useRef(new HolisticTrackingStabilizer());
  const lastHolisticTimeRef = useRef(0);
  const lastDisplayFrameRef = useRef(0);
  const runtimeProfileRef = useRef(getRuntimeProfile());
  const pageVisibleRef = useRef(!document.hidden);
  const lastDetectedSignRef = useRef('NONE');
  const languageRef = useRef(language);

  // Sticky-Latch Hysteresis Stabilization Refs
  const lockedSignRef = useRef('NONE');
  const lockedScoreRef = useRef(0);
  const dynamicHoldUntilRef = useRef(0);
  const lastSpokenSignRef = useRef('NONE');
  const consecutiveCandidateRef = useRef(null);
  const consecutiveCandidateCountRef = useRef(0);
  const lastProcessedStaticPredictionRef = useRef(0);
  const noHandFramesRef = useRef(0);
  const ambiguousFramesRef = useRef(0);
  const dynamicTrackerRef = useRef(new DynamicGestureTracker());
  const dynamicSegmenterRef = useRef(new DynamicGestureSegmenter());
  const sequencePredictionRef = useRef(null);
  const dynamicPredictionRef = useRef(null);
  const dynamicPredictionReadyRef = useRef(false);
  const dynamicAwaitingResultRef = useRef(false);
  const noHandFinishAttemptedRef = useRef(false);
  const sequenceInferenceBusyRef = useRef(false);
  const lastSequenceInferenceRef = useRef(0);
  const inferenceGenerationRef = useRef(0);
  const gestureRejectionGateRef = useRef(new GestureRejectionGate());
  const lastSafetyFrameTimestampRef = useRef(0);
  const safetyRejectionVisibleRef = useRef(false);
  const dominantHandSideRef = useRef(null);

  useEffect(() => {
    languageRef.current = language;
    lockedSignRef.current = 'NONE';
    lockedScoreRef.current = 0;
    dynamicHoldUntilRef.current = 0;
    lastSpokenSignRef.current = 'NONE';
    consecutiveCandidateRef.current = null;
    consecutiveCandidateCountRef.current = 0;
    lastProcessedStaticPredictionRef.current = 0;
    noHandFramesRef.current = 0;
    ambiguousFramesRef.current = 0;
    lastDetectedSignRef.current = 'NONE';
    setIsSignLocked(false);
    sequencePredictionRef.current = null;
    dynamicPredictionRef.current = null;
    dynamicPredictionReadyRef.current = false;
    dynamicAwaitingResultRef.current = false;
    noHandFinishAttemptedRef.current = false;
    inferenceGenerationRef.current += 1;
    gestureRejectionGateRef.current.reset();
    safetyRejectionVisibleRef.current = false;
    dominantHandSideRef.current = null;
    if (dynamicTrackerRef.current) dynamicTrackerRef.current.reset();
    dynamicSegmenterRef.current.reset();
  }, [language]);

  // Mode Switch Lifecycle: Resets all latches, queues, and caches when switching modes for 100% clean isolation
  useEffect(() => {
    signModeRef.current = signMode;
    localStorage.setItem('signsync_sign_mode', signMode);
    lockedSignRef.current = 'NONE';
    lockedScoreRef.current = 0;
    dynamicHoldUntilRef.current = 0;
    lastSpokenSignRef.current = 'NONE';
    consecutiveCandidateRef.current = null;
    consecutiveCandidateCountRef.current = 0;
    lastProcessedStaticPredictionRef.current = 0;
    ambiguousFramesRef.current = 0;
    lastDetectedSignRef.current = 'NONE';
    setIsSignLocked(false);
    sequencePredictionRef.current = null;
    dynamicPredictionRef.current = null;
    dynamicPredictionReadyRef.current = false;
    dynamicAwaitingResultRef.current = false;
    noHandFinishAttemptedRef.current = false;
    inferenceGenerationRef.current += 1;
    gestureRejectionGateRef.current.reset();
    safetyRejectionVisibleRef.current = false;
    dominantHandSideRef.current = null;
    if (dynamicTrackerRef.current) dynamicTrackerRef.current.reset();
    dynamicSegmenterRef.current.reset();
    setHandPostureStatus(
      signMode === 'fingerspelling'
        ? 'Alphabet & Numbers Mode: Ready for static letters (A-Z) & numbers (0-9)'
        : 'Conversational Phrases Mode: Ready for dynamic signs (Hello, Thank You, etc.)'
    );
    setTranslatedText(
      signMode === 'fingerspelling'
        ? 'Ready for Fingerspelling (A-Z, 0-9)'
        : 'Ready for Conversational Phrases'
    );
  }, [signMode]);

  const motionTrailRef = useRef([]);
  const isCameraActiveRef = useRef(false);
  const isProcessingFrameRef = useRef(false);
  const latestHolisticResultsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const lastQueuePushTimeRef = useRef(0);
  const lastQueuedHolisticTimestampRef = useRef(0);

  const scheduleStaticInference = (features, dialect, nowInMs) => {
    if (!staticModel || !staticMetadata || sequenceInferenceBusyRef.current) return;
    if (nowInMs - lastSequenceInferenceRef.current < 65) return;

    lastSequenceInferenceRef.current = nowInMs;
    sequenceInferenceBusyRef.current = true;
    const generation = inferenceGenerationRef.current;
    predictStatic({ model: staticModel, metadata: staticMetadata, features, dialect })
      .then((prediction) => {
        if (generation === inferenceGenerationRef.current) {
          sequencePredictionRef.current = prediction
            ? { ...prediction, timestamp: performance.now() }
            : null;
        }
      })
      .catch((error) => {
        console.warn('[SignSync] Static inference failed:', error);
      })
      .finally(() => {
        sequenceInferenceBusyRef.current = false;
      });
  };

  const scheduleDynamicInference = (frames, dialect) => {
    if (
      !dynamicModel || !dynamicMetadata || sequenceInferenceBusyRef.current ||
      dynamicAwaitingResultRef.current || !frames?.length
    ) return false;
    const completedSequence = new SequenceRingBuffer();
    frames.forEach((frame) => completedSequence.push(frame));
    sequenceInferenceBusyRef.current = true;
    dynamicAwaitingResultRef.current = true;
    dynamicPredictionReadyRef.current = false;
    const generation = inferenceGenerationRef.current;
    predictDynamicSequence({
      model: dynamicModel, metadata: dynamicMetadata,
      ringBuffer: completedSequence, dialect,
    }).then((prediction) => {
      if (generation === inferenceGenerationRef.current) {
        dynamicPredictionRef.current = prediction
          ? { ...prediction, timestamp: performance.now() }
          : null;
        dynamicPredictionReadyRef.current = true;
      }
    }).catch((error) => {
      console.warn('[SignSync] Dynamic inference failed:', error);
      if (generation === inferenceGenerationRef.current) {
        dynamicPredictionRef.current = null;
        dynamicPredictionReadyRef.current = true;
      }
    }).finally(() => {
      sequenceInferenceBusyRef.current = false;
      if (generation !== inferenceGenerationRef.current) {
        dynamicAwaitingResultRef.current = false;
      }
    });
    return true;
  };

  // Initialize MediaPipe models. The quantized GRU is loaded once by ModelContext.
  useEffect(() => {
    let isMounted = true;

    if (activeSubTab !== 'sign-to-text') return undefined;

    const initAI = async () => {
      try {
        await loadHolistic();
        if (window.Holistic) {
          try {
            const holistic = new window.Holistic({
              locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
            });

            const profile = runtimeProfileRef.current;
            holistic.setOptions({
              modelComplexity: profile.lowPower ? 1 : 2,
              smoothLandmarks: true,
              enableSegmentation: false,
              smoothSegmentation: false,
              refineFaceLandmarks: true,
              minDetectionConfidence: 0.6,
              minTrackingConfidence: 0.55,
            });

            holistic.onResults((results) => {
              latestHolisticResultsRef.current = holisticStabilizerRef.current.update(results, Date.now());
            });

            holisticRef.current = holistic;
          } catch (e) {
            console.warn('[SignSync] Holistic instantiation warning:', e);
          }
        }

        if (isMounted) {
          setHandPostureStatus('MediaPipe Holistic recognition engine ready');
        }
      } catch (err) {
        console.warn('[SignSync] Model init exception:', err);
        if (isMounted) {
          setHandPostureStatus('Landmark inference engine active');
        }
      }
    };

    initAI();

    return () => {
      isMounted = false;
      holisticStabilizerRef.current.reset();
      holisticRef.current?.close?.();
      holisticRef.current = null;
    };
  }, [activeSubTab]);

  useEffect(() => {
    const handleVisibility = () => {
      pageVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Process video using the same Holistic engine used during recording.
  const processVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActiveRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    try {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const nowInMs = Date.now();
        const profile = runtimeProfileRef.current;
        if (!pageVisibleRef.current || nowInMs - lastDisplayFrameRef.current < profile.displayIntervalMs) return;
        lastDisplayFrameRef.current = nowInMs;
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // A bounded visual grace period prevents a slow inference callback from
        // blinking every marker off between frames without leaving a stuck pose.
        if (!isFreshHolisticResult(latestHolisticResultsRef.current, nowInMs, 700)) {
          latestHolisticResultsRef.current = null;
        }

        // Keep capture close to the recording cadence. Dynamic inference now runs
        // once per completed gesture, so it no longer competes with every frame.
        if (holisticRef.current && !isProcessingFrameRef.current && (nowInMs - lastHolisticTimeRef.current > profile.inferenceIntervalMs)) {
          isProcessingFrameRef.current = true;
          lastHolisticTimeRef.current = nowInMs;
          try {
            holisticRef.current.send({ image: video }).catch(() => { }).finally(() => {
              isProcessingFrameRef.current = false;
            });
          } catch {
            isProcessingFrameRef.current = false;
          }
        }

        // Use the same Holistic landmarks used by the recording studio. Mixing
        // a separate hand model with Holistic pose coordinates caused a large
        // live/training distribution mismatch.
        let detectedHandObjects = [];
        const holisticRes = latestHolisticResultsRef.current;
        if (holisticRes) {
          detectedHandObjects = selectActiveHandObjects(holisticRes);
        }

        const detectedHandLandmarks = detectedHandObjects.map((h) => h.landmarks);
        const poseLandmarks = holisticRes?.poseLandmarks || null;
        const faceLandmarks = holisticRes?.faceLandmarks || null;

        // Draw face, chest, arms, hands and every finger from the same stabilized
        // Holistic result that feeds recognition.
        drawHolisticSkeleton(ctx, poseLandmarks, detectedHandLandmarks, faceLandmarks);

        // 4. Add this frame to the rolling GRU sequence and classify asynchronously.
        // Throttled to ~28-30 FPS (every 35ms) to preserve mobile/tablet battery and eliminate thermal stutter on 120Hz displays
        if (detectedHandObjects.length > 0) {
          const safetyTimestamp = holisticRes?._timestamp || nowInMs;
          if (safetyTimestamp !== lastSafetyFrameTimestampRef.current) {
            lastSafetyFrameTimestampRef.current = safetyTimestamp;
            const containsRejectedGesture = detectedHandObjects.some(({ landmarks }) => (
              isIsolatedMiddleFingerGesture(landmarks)
            ));
            gestureRejectionGateRef.current.update(containsRejectedGesture);
          }

          if (gestureRejectionGateRef.current.rejected) {
            lockedSignRef.current = 'NONE';
            lockedScoreRef.current = 0;
            dynamicHoldUntilRef.current = 0;
            consecutiveCandidateRef.current = null;
            consecutiveCandidateCountRef.current = 0;
            sequencePredictionRef.current = null;
            dynamicPredictionRef.current = null;
            dynamicPredictionReadyRef.current = false;
            dynamicAwaitingResultRef.current = false;
            dynamicTrackerRef.current.reset();
            dynamicSegmenterRef.current.reset();
            setIsSignLocked(false);
            setDetectedSign('NONE');
            setConfidence(0);
            setTranslatedText('Gesture not understood. Please try another sign.');
            setHandPostureStatus('Gesture not understood — show a valid trained sign');
            safetyRejectionVisibleRef.current = true;
            return;
          }

          if (safetyRejectionVisibleRef.current) {
            safetyRejectionVisibleRef.current = false;
            setTranslatedText('Waiting for gesture...');
            setHandPostureStatus('Gesture cleared — ready for a trained sign');
          }

          noHandFramesRef.current = 0;
          noHandFinishAttemptedRef.current = false;
          const currentLang = languageRef.current || 'ASL';

          // 1. Feed trajectory buffer for multi-frame dynamic gestures
          const primaryHand = detectedHandObjects[0]?.landmarks;
          const secondHand = detectedHandObjects[1]?.landmarks || null;
          const isLeft = detectedHandObjects[0]?.isLeft || false;
          const currentSingleSide = detectedHandObjects.length === 1 ? (isLeft ? 'left' : 'right') : null;
          if (
            currentSingleSide && dominantHandSideRef.current &&
            currentSingleSide !== dominantHandSideRef.current
          ) {
            // A direct left/right switch starts a new gesture. Never combine
            // the tail of one hand with the beginning of the other.
            dynamicTrackerRef.current.reset();
            dynamicSegmenterRef.current.reset();
            dynamicPredictionRef.current = null;
            dynamicPredictionReadyRef.current = false;
            dynamicAwaitingResultRef.current = false;
            inferenceGenerationRef.current += 1;
          }
          if (currentSingleSide) dominantHandSideRef.current = currentSingleSide;
          dynamicTrackerRef.current.pushFrame(primaryHand, secondHand, poseLandmarks, isLeft);

          // Update the fixed-size rolling sequence at camera cadence. Inference is
          // asynchronous and never waits for a separate 60-frame capture pass.
          const holisticTimestamp = holisticRes?._timestamp || 0;
          if (
            holisticTimestamp > lastQueuedHolisticTimestampRef.current &&
            nowInMs - lastQueuePushTimeRef.current >= profile.inferenceIntervalMs
          ) {
            lastQueuedHolisticTimestampRef.current = holisticTimestamp;
            lastQueuePushTimeRef.current = nowInMs;
            const primaryFeats = extractFeatures72(primaryHand);
            if (primaryFeats) {
              const activeTip = primaryHand[8];
              if (activeTip) {
                motionTrailRef.current.push({ x: activeTip.x, y: activeTip.y, time: nowInMs });
                if (motionTrailRef.current.length > 25) motionTrailRef.current.shift();
              }
              const rightHand = detectedHandObjects.find((hand) => !hand.isLeft)?.landmarks || null;
              const leftHand = detectedHandObjects.find((hand) => hand.isLeft)?.landmarks || null;
              const v2Features = extractDynamicFeaturesV2(rightHand, leftHand, poseLandmarks);
              const inferenceMode = signModeRef.current || 'fingerspelling';
              if (inferenceMode === 'phrases' && v2Features) {
                if (!dynamicAwaitingResultRef.current) {
                  const segmentEvent = dynamicSegmenterRef.current.push(v2Features);
                  if (segmentEvent?.type === 'completed') {
                    scheduleDynamicInference(segmentEvent.frames, currentLang);
                  }
                }
              } else if (inferenceMode === 'fingerspelling') {
                scheduleStaticInference(primaryFeats, currentLang, nowInMs);
              }
            }
          }

          const currentMode = signModeRef.current || 'fingerspelling';
          const isDynamicHoldActive = nowInMs < dynamicHoldUntilRef.current;

          let dynamicResult = null;
          let staticResult = null;

          // =====================================================================
          // MODE 1: FINGERSPELLING & ALPHABET (Letters A-Z & Numbers 0-9)
          // 100% PURE STATIC NEURAL RECOGNITION.
          // Dynamic sequence inference & phrase heuristics are COMPLETELY DISABLED.
          // Guarantees zero "YES", zero "Goodbye", zero dynamic phrase interference!
          // =====================================================================
          if (currentMode === 'fingerspelling') {
            const latestPrediction = sequencePredictionRef.current;
            if (latestPrediction && performance.now() - latestPrediction.timestamp < 500) {
              staticResult = latestPrediction;
            }
            if (staticResult) {
              const refined = refineFingerspellingPrediction(
                staticResult.sign,
                staticResult.score,
                primaryHand,
                dynamicTrackerRef.current,
              );
              staticResult = {
                ...staticResult,
                sign: refined.sign,
                label: `${currentLang}_${refined.sign}`,
                refinementReason: refined.reason,
              };
            }
            // Ñ is an N-handshape plus horizontal wrist motion. Wrist-relative
            // static features cannot retain that travel, so verify its stroke
            // with the live trajectory tracker.
            if (currentLang === 'FSL') {
              const motionResult = dynamicTrackerRef.current.evaluate('FSL', staticResult?.sign);
              if (motionResult?.sign === 'Ñ') {
                staticResult = {
                  ...motionResult,
                  label: 'FSL_Ñ',
                  timestamp: performance.now(),
                };
              }
            }
          }
          // =====================================================================
          // MODE 2: CONVERSATIONAL PHRASES (completion-based GRU)
          // Infer once after motion ends instead of voting on incomplete prefixes.
          // =====================================================================
          else {
            if (!isDynamicHoldActive && dynamicPredictionReadyRef.current) {
              dynamicResult = dynamicPredictionRef.current;
              dynamicPredictionRef.current = null;
              dynamicPredictionReadyRef.current = false;
              dynamicAwaitingResultRef.current = false;
            }
          }

          // CASE A: DYNAMIC SIGN DETECTED WITH CONFIDENCE FROM RECORDED DATASET
          if (dynamicResult && dynamicResult.score >= 48) {
            const dynSign = dynamicResult.sign;
            const dynScore = dynamicResult.score;
            lockedSignRef.current = dynSign;
            lockedScoreRef.current = dynScore;
            dynamicHoldUntilRef.current = nowInMs + DYNAMIC_HOLD_MS;
            dynamicTrackerRef.current.reset();
            consecutiveCandidateRef.current = null;
            consecutiveCandidateCountRef.current = 0;
            ambiguousFramesRef.current = 0;
            dynamicPredictionRef.current = null;
            dynamicPredictionReadyRef.current = false;
            dynamicAwaitingResultRef.current = false;
            dynamicSegmenterRef.current.reset();
            setIsSignLocked(true);

            lastDetectedSignRef.current = dynSign;
            setDetectedSign(dynSign);
            setConfidence(dynScore);
            const formattedSign = getHumanReadableSign(dynSign, currentLang);
            setTranslatedText(formattedSign);
            setHandPostureStatus(`Dynamic Sign: ${formattedSign} (${dynScore}%)`);

            if (lastSpokenSignRef.current !== dynSign) {
              lastSpokenSignRef.current = dynSign;
              speakText(dynSign);
            }
          }
          // CASE B: DYNAMIC GESTURE HOLD ACTIVE (Preserve output steadily while user lowers hand)
          else if (isDynamicHoldActive && lockedSignRef.current !== 'NONE') {
            const formattedSign = getHumanReadableSign(lockedSignRef.current, currentLang);
            setHandPostureStatus(`Holding '${formattedSign}' (${lockedScoreRef.current}%)`);
          }
          // CASE C: STATIC SIGN RECOGNITION (same GRU, static-label filtered)
          else if (currentMode === 'fingerspelling' && staticResult && staticResult.score >= 45) {
            ambiguousFramesRef.current = 0;
            const currentPredSign = staticResult.sign;
            const currentPredScore = staticResult.score;
            const isNewPrediction =
              staticResult.timestamp !== lastProcessedStaticPredictionRef.current;

            // Track consecutive candidate frame streak for jitter-free confirmation
            if (isNewPrediction) {
              lastProcessedStaticPredictionRef.current = staticResult.timestamp;
              if (currentPredSign === consecutiveCandidateRef.current) {
                consecutiveCandidateCountRef.current += 1;
              } else {
                consecutiveCandidateRef.current = currentPredSign;
                consecutiveCandidateCountRef.current = 1;
              }
            }

            const streak = consecutiveCandidateCountRef.current;

            // CASE C1: No sign currently locked
            if (lockedSignRef.current === 'NONE') {
              // Require independent model updates; render frames must not count
              // as repeated evidence for the same prediction.
              if (isNewPrediction && streak >= Number(staticMetadata?.thresholds?.confirmationPredictions || 2)) {
                lockedSignRef.current = currentPredSign;
                lockedScoreRef.current = currentPredScore;
                consecutiveCandidateCountRef.current = 0;
                setIsSignLocked(true);

                lastDetectedSignRef.current = currentPredSign;
                setDetectedSign(currentPredSign);
                setConfidence(currentPredScore);
                const formattedSign = getHumanReadableSign(currentPredSign, currentLang);
                setTranslatedText(formattedSign);
                setHandPostureStatus(`Locked & Steady: ${formattedSign} (${currentPredScore}%)`);

                if (lastSpokenSignRef.current !== currentPredSign) {
                  lastSpokenSignRef.current = currentPredSign;
                  speakText(currentPredSign);
                }
              } else {
                const formattedSign = getHumanReadableSign(currentPredSign, currentLang);
                setHandPostureStatus(`Detecting posture: ${formattedSign} (${currentPredScore}%)`);
              }
            }
            // CASE C2: Sign already locked (Strong Anti-Fluctuation Hysteresis)
            else {
              if (currentPredSign === lockedSignRef.current) {
                lockedScoreRef.current = Math.round(0.85 * lockedScoreRef.current + 0.15 * currentPredScore);
                consecutiveCandidateRef.current = null;
                consecutiveCandidateCountRef.current = 0;

                setConfidence(lockedScoreRef.current);
                setIsSignLocked(true);
                const formattedSign = getHumanReadableSign(lockedSignRef.current, currentLang);
                setHandPostureStatus(`Holding '${formattedSign}' (Stable ${lockedScoreRef.current}%)`);
              } else {
                // Firm hysteresis: To switch away from an already-locked sign,
                // the user must deliberately hold the new sign for at least 5 frames (~160ms)
                // or at least 3 consecutive frames with high confidence (>= 88%).
                // Momentary twitches or 1-2 frame glitches are strictly ignored!
                const isDeliberateSwitch = isNewPrediction &&
                  (streak >= 5 || (currentPredScore >= 88 && streak >= 3));
                if (isDeliberateSwitch) {
                  lockedSignRef.current = currentPredSign;
                  lockedScoreRef.current = currentPredScore;
                  consecutiveCandidateCountRef.current = 0;
                  setIsSignLocked(true);

                  lastDetectedSignRef.current = currentPredSign;
                  setDetectedSign(currentPredSign);
                  setConfidence(currentPredScore);
                  const formattedSign = getHumanReadableSign(currentPredSign, currentLang);
                  setTranslatedText(formattedSign);
                  setHandPostureStatus(`Switched to '${formattedSign}' (${currentPredScore}%)`);

                  if (lastSpokenSignRef.current !== currentPredSign) {
                    lastSpokenSignRef.current = currentPredSign;
                    speakText(currentPredSign);
                  }
                } else {
                  const formattedSign = getHumanReadableSign(lockedSignRef.current, currentLang);
                  setHandPostureStatus(`Holding '${formattedSign}'...`);
                }
              }
            }
          } else {
            // Hand detected in frame but transitioning / low confidence
            if (currentMode === 'phrases') {
              if (lockedSignRef.current !== 'NONE' && isDynamicHoldActive) {
                const formattedSign = getHumanReadableSign(lockedSignRef.current, currentLang);
                setHandPostureStatus(`Holding '${formattedSign}' (${lockedScoreRef.current}%)`);
              } else if (dynamicAwaitingResultRef.current) {
                setHandPostureStatus('Analyzing completed dynamic sign...');
              } else {
                const segment = dynamicSegmenterRef.current.snapshot();
                setHandPostureStatus(
                  segment.state === 'recording'
                    ? `Recording dynamic sign... (${segment.frameCount}/60 frames)`
                    : 'Hand in view - move naturally, then pause to translate'
                );
              }
            } else {
              ambiguousFramesRef.current += 1;
              if (ambiguousFramesRef.current >= 4) {
                consecutiveCandidateRef.current = null;
                consecutiveCandidateCountRef.current = 0;
              }

              if (ambiguousFramesRef.current >= 18) {
                if (lockedSignRef.current !== 'NONE') {
                  lockedSignRef.current = 'NONE';
                  lockedScoreRef.current = 0;
                  setIsSignLocked(false);
                  setHandPostureStatus('Hand posture released — Ready for next sign');
                } else {
                  setHandPostureStatus('Hand keypoints detected — Ready for sign');
                }
              } else if (lockedSignRef.current !== 'NONE') {
                const formattedSign = getHumanReadableSign(lockedSignRef.current, currentLang);
                setHandPostureStatus(`Holding '${formattedSign}'...`);
              }
            }
          }
        } else {
          // Hands out of view: finish the captured segment and preserve it until
          // its one asynchronous inference completes.
          const currentMode = signModeRef.current || 'fingerspelling';
          const currentLang = languageRef.current || 'ASL';
          const isDynamicHoldActive = nowInMs < dynamicHoldUntilRef.current;

          if (currentMode === 'phrases' && !isDynamicHoldActive) {
            if (
              !dynamicAwaitingResultRef.current &&
              !dynamicPredictionReadyRef.current &&
              !noHandFinishAttemptedRef.current
            ) {
              noHandFinishAttemptedRef.current = true;
              const completed = dynamicSegmenterRef.current.finish();
              if (completed?.type === 'completed') {
                scheduleDynamicInference(completed.frames, currentLang);
              }
            }

            if (dynamicPredictionReadyRef.current) {
              const exitPrediction = dynamicPredictionRef.current;
              dynamicPredictionRef.current = null;
              dynamicPredictionReadyRef.current = false;
              dynamicAwaitingResultRef.current = false;

              if (exitPrediction?.isDynamic && exitPrediction.score >= 48) {
                const dynSign = exitPrediction.sign;
                const dynScore = exitPrediction.score;
                lockedSignRef.current = dynSign;
                lockedScoreRef.current = dynScore;
                dynamicHoldUntilRef.current = nowInMs + DYNAMIC_HOLD_MS;
                dynamicTrackerRef.current.reset();
                dynamicSegmenterRef.current.reset();
                setIsSignLocked(true);
                lastDetectedSignRef.current = dynSign;
                setDetectedSign(dynSign);
                setConfidence(dynScore);
                const formattedSign = getHumanReadableSign(dynSign, currentLang);
                setTranslatedText(formattedSign);
                setHandPostureStatus(`Dynamic Sign: ${formattedSign} (${dynScore}%)`);
                if (lastSpokenSignRef.current !== dynSign) {
                  lastSpokenSignRef.current = dynSign;
                  speakText(dynSign);
                }
              } else {
                setHandPostureStatus('Completed phrase was uncertain - please repeat it once');
              }
            } else if (dynamicAwaitingResultRef.current) {
              setHandPostureStatus('Analyzing completed dynamic sign...');
            }
          }

          noHandFramesRef.current += 1;
          consecutiveCandidateRef.current = null;
          consecutiveCandidateCountRef.current = 0;
          lastProcessedStaticPredictionRef.current = 0;
          ambiguousFramesRef.current = 0;
          dynamicTrackerRef.current.reset();
          dominantHandSideRef.current = null;
          if (currentMode === 'fingerspelling') {
            sequencePredictionRef.current = null;
            inferenceGenerationRef.current += 1;
          }

          // Grace period: require 6 frames (~200ms) of no hands before resetting internal latch
          // Note: Preserves translated text on screen so user can read what was signed!
          const isDynamicHoldActiveOnNoHand = nowInMs < dynamicHoldUntilRef.current;
          if (
            noHandFramesRef.current >= 6 &&
            !isDynamicHoldActiveOnNoHand &&
            !dynamicAwaitingResultRef.current
          ) {
            if (lockedSignRef.current !== 'NONE') {
              lockedSignRef.current = 'NONE';
              lockedScoreRef.current = 0;
              setIsSignLocked(false);
              lastSpokenSignRef.current = 'NONE';
            }
            if (poseLandmarks) {
              setHandPostureStatus('Body Pose Tracked — Place hand(s) in camera view');
            } else {
              setHandPostureStatus('Place hand(s) clearly inside camera view');
            }
          }
        }
      }
    } catch (frameErr) {
      console.warn('[SignSync] Frame processing exception:', frameErr);
    } finally {
      if (isCameraActiveRef.current) {
        animFrameRef.current = requestAnimationFrame(processVideoFrame);
      }
    }
  };

  // Handle Camera Start / Stop
  const toggleCamera = async () => {
    if (isCameraActive) {
      isCameraActiveRef.current = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      latestHolisticResultsRef.current = null;
      holisticStabilizerRef.current.reset();
      motionTrailRef.current = [];
      setIsCameraActive(false);
      setHandPostureStatus('Camera stopped.');
    } else {
      try {
        setHandPostureStatus('Accessing camera feed...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraConstraints(runtimeProfileRef.current),
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setIsCameraActive(true);
            isCameraActiveRef.current = true;
            setHandPostureStatus('Tracking pose & dual hand keypoints in real time...');
            processVideoFrame();
          };
        }
      } catch {
        alert('Could not access webcam. Please allow camera permissions in your browser.');
        setHandPostureStatus('Camera permission denied');
      }
    }
  };

  useEffect(() => {
    if (activeSubTab === 'sign-to-text' || !isCameraActiveRef.current) return;
    isCameraActiveRef.current = false;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    setIsCameraActive(false);
  }, [activeSubTab]);

  // Re-attach active camera stream when switching between Sign-to-Text and Dataset Studio
  useEffect(() => {
    if (isCameraActiveRef.current && mediaStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        videoRef.current.play().catch(() => { });
      }
    }
  }, [activeSubTab, isCameraActive]);

  // Draw Full MediaPipe Holistic Overlays (Face, Body Pose, Left Hand, Right Hand)
  const drawHolisticSkeleton = (ctx, posePts, handLandmarksList = [], facePts = null) => {
    ctx.lineWidth = 3.6; // Bold line width as requested by user
    ctx.strokeStyle = '#38bdf8'; // Crisp light cyan

    // 1. Draw Upper Body Pose Connections (Shoulders, Arms, Torso, Head anchor)
    if (posePts) {
      const POSE_CONNECTIONS = [
        [11, 12], // Shoulders
        [11, 13], [13, 15], // Left arm
        [12, 14], [14, 16], // Right arm
        [11, 23], [12, 24], [23, 24], // Torso hips
        [0, 11], [0, 12] // Nose to shoulders
      ];

      POSE_CONNECTIONS.forEach(([i, j]) => {
        const p1 = posePts[i];
        const p2 = posePts[j];
        if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
          ctx.beginPath();
          ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
          ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
          ctx.stroke();
        }
      });

      // Draw Pose Joint Dots
      [0, 11, 12, 13, 14, 15, 16, 23, 24].forEach((idx) => {
        const pt = posePts[idx];
        if (pt && (pt.visibility ?? 1) > 0.4) {
          ctx.beginPath();
          ctx.fillStyle = '#0ea5e9';
          ctx.arc(pt.x * ctx.canvas.width, pt.y * ctx.canvas.height, 4.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // A lightweight face contour keeps facial orientation visible without
    // drawing all 478 points over the user's expression.
    if (facePts?.length) {
      const FACE_LOOPS = [
        [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
        [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
      ];
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
      ctx.lineWidth = 2.2;
      FACE_LOOPS.forEach((indices) => {
        ctx.beginPath();
        indices.forEach((index, pointIndex) => {
          const point = facePts[index];
          if (!point) return;
          const x = point.x * ctx.canvas.width;
          const y = point.y * ctx.canvas.height;
          if (pointIndex === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
      ctx.restore();
    }

    // 2. Draw Left & Right Hand Skeletons
    const HAND_CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]
    ];

    if (Array.isArray(handLandmarksList)) {
      handLandmarksList.forEach((handPts) => {
        if (!handPts) return;

        HAND_CONNECTIONS.forEach(([i, j]) => {
          const p1 = handPts[i];
          const p2 = handPts[j];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
            ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
            ctx.stroke();
          }
        });

        handPts.forEach((pt, index) => {
          ctx.beginPath();
          const isFingertip = [4, 8, 12, 16, 20].includes(index);
          ctx.fillStyle = isFingertip ? '#34d399' : '#38bdf8';
          const radius = isFingertip ? 5.5 : 4.0;

          ctx.arc(pt.x * ctx.canvas.width, pt.y * ctx.canvas.height, radius, 0, 2 * Math.PI);
          ctx.fill();
        });
      });
    }

    // 3. Draw Neon Glowing Fingertip Motion Trail for Dynamic Gestures
    if (motionTrailRef.current && motionTrailRef.current.length > 1) {
      const trail = motionTrailRef.current;
      for (let i = 1; i < trail.length; i++) {
        const alpha = i / trail.length;
        ctx.strokeStyle = `rgba(52, 211, 153, ${alpha * 0.85})`;
        ctx.lineWidth = 4.0 * alpha;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x * ctx.canvas.width, trail[i - 1].y * ctx.canvas.height);
        ctx.lineTo(trail[i].x * ctx.canvas.width, trail[i].y * ctx.canvas.height);
        ctx.stroke();
      }
    }
  };


  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Build a dialect-locked phrase/fingerspelling playback queue.
  const handleTriggerSign = (rawText) => {
    if (!rawText) return;
    const clean = rawText.trim();
    setInputMessage(clean);
    setTranslationNotice('');

    const result = createSignSequence(clean, language);
    if (!result.sequence.length || result.unsupported.length) {
      setSignSequence([]);
      setCurrentSequenceIndex(0);
      setCurrentAnimatingWord('NONE');
      const unsupported = result.unsupported.length ? ' Unsupported: ' + result.unsupported.join(', ') + '.' : '';
      setTranslationNotice('“' + clean + '” cannot be represented completely with the trained ' + language + ' catalog.' + unsupported);
      setAnimationToken((value) => value + 1);
      return;
    }

    setSignSequence(result.sequence);
    setCurrentSequenceIndex(0);
    setCurrentAnimatingWord(result.sequence[0].key);
    setAnimationToken((value) => value + 1);
  };

  // Explicit pauses keep repeated letters and word boundaries readable.
  useEffect(() => {
    if (signSequence.length <= 1 || currentSequenceIndex >= signSequence.length - 1) return;
    const currentStep = signSequence[currentSequenceIndex];
    const intervalMs = Math.round(currentStep.durationMs / (playbackSpeed || 1.0));
    const timer = setTimeout(() => {
      const nextIndex = currentSequenceIndex + 1;
      setCurrentSequenceIndex(nextIndex);
      setCurrentAnimatingWord(signSequence[nextIndex].key);
      setAnimationToken((value) => value + 1);
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [currentSequenceIndex, signSequence, playbackSpeed]);
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      setSpeechStatus('Voice recording stopped.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'FSL' ? 'fil-PH' : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechStatus('Listening... Speak into microphone');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      handleTriggerSign(transcript);
      setIsListening(false);
      setSpeechStatus(`Recognized: "${transcript}"`);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setSpeechStatus('Error capturing voice.');
    };

    recognition.start();
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      let rawText = text || '';
      // Strip system prefixes like "Recognized (FSL): " or "Recognized (ASL): "
      const cleanToSpeak = rawText.replace(/^Recognized \([^)]+\):\s*/i, '').trim();
      if (!cleanToSpeak || cleanToSpeak === 'NONE' || cleanToSpeak === 'Waiting for gesture...') return;

      const activeLang = languageRef.current || language;
      const textToSpeak = getSpokenSignText(cleanToSpeak, activeLang) || cleanToSpeak;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const isSingleChar = /^[A-Za-z0-9]$/.test(textToSpeak);
      const isEnye = textToSpeak.toLowerCase() === 'enye';
      utterance.lang = (isEnye || (activeLang === 'FSL' && !isSingleChar)) ? 'fil-PH' : 'en-US';
      utterance.rate = 0.90;
      utterance.pitch = 1.0;

      // Match available system voices for Filipino / Tagalog or English
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const langTarget = (isEnye || (activeLang === 'FSL' && !isSingleChar)) ? 'fil' : 'en';
        const matchVoice = voices.find((v) => v.lang.toLowerCase().includes(langTarget));
        if (matchVoice) utterance.voice = matchVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fade-in responsive-page translator-page" style={{ maxWidth: '1040px', margin: '0 auto', padding: '1rem 0 3rem 0' }}>
      {isGuidanceOpen && (() => {
        const supportedCatalogs = ['ASL', 'FSL'].map((dialect) => ({
          dialect,
          catalog: DATASET_CATALOG[dialect],
          isSelected: dialect === language,
        }));
        return (
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              display: 'grid',
              placeItems: 'center',
              padding: 'clamp(0.75rem, 3vw, 1.5rem)',
              background: 'rgba(2, 6, 23, 0.78)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="translator-guidance-title"
              style={{
                width: 'min(100%, 780px)',
                maxHeight: 'calc(100dvh - 1.5rem)',
                overflowY: 'auto',
                padding: 'clamp(1rem, 3vw, 1.5rem)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(56, 189, 248, 0.42)',
                background: 'var(--bg-surface)',
                boxShadow: '0 24px 72px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.85rem' }}>
                <div>
                  <h2 id="translator-guidance-title" style={{ margin: 0, fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', lineHeight: 1.2 }}>
                    Supported signs and translation guidance
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  aria-label="Close translator guidance"
                  onClick={dismissGuidance}
                  style={{ padding: '0.4rem', minWidth: '2.25rem', minHeight: '2.25rem' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                The translator recognizes and animates only the pre-trained ASL and FSL items below. The currently selected {language} dataset is highlighted. Unlisted words are not trained signs; text-to-sign can only spell them using the trained characters.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                {supportedCatalogs.map(({ dialect, catalog, isSelected }) => (
                  <div
                    key={dialect}
                    style={{
                      padding: '0.85rem',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.025)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.6rem' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{dialect} pre-trained signs</strong>
                      {isSelected && <span className="badge badge-blue">Selected</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', marginBottom: '0.7rem' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Letters ({catalog.letters.length})</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4 }}>{catalog.letters.join(', ')}</span>
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Numbers ({catalog.numbers.length})</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4 }}>{catalog.numbers.join(', ')}</span>
                      </div>
                    </div>
                    <details>
                      <summary style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '0.76rem', fontWeight: 700 }}>
                        View all {catalog.phrases.length} trained phrases
                      </summary>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.55rem' }}>
                        {catalog.phrases.map((phrase) => (
                          <span key={phrase.key} className={`badge ${dialect === 'ASL' ? 'badge-blue' : 'badge-green'}`} style={{ whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.2 }}>
                            {phrase.label}
                          </span>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(251, 191, 36, 0.09)', border: '1px solid rgba(251, 191, 36, 0.24)' }}>
                  <strong style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.35rem' }}>Follow the best practices</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                    Use even lighting, a plain background, and stay about 2–3 feet from the camera with your hands and torso fully visible.
                  </span>
                </div>
                <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.24)' }}>
                  <strong style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.35rem' }}>If the output is incorrect</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                    Reset and try again while signing a little more slowly, keeping the full hand and arm movement in frame.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" onClick={openSettingsGuidance} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ListChecks className="w-4 h-4" />
                  Open Settings guidance
                </button>
                <button type="button" className="btn btn-primary" onClick={dismissGuidance}>
                  Got it
                </button>
              </div>
            </section>
          </div>
        );
      })()}

      {/* 1. Header & Controls Section (Clean Open Editorial, No Cards) */}
      <section style={{ paddingBottom: '1.75rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
        <div className="responsive-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
              <span className={`badge ${language === 'ASL' ? 'badge-blue' : 'badge-green'}`}>
                {language} Mode
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.6rem)',
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                marginBottom: '0.5rem',
              }}
            >
              Real-Time Translator
            </h1>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '580px', lineHeight: 1.5 }}>
              Two-way translation between sign language gestures, text, and speech for American Sign Language (ASL) and Filipino Sign Language (FSL).
            </p>
          </div>

          {/* Mode Switcher & Dialect Controls */}
          <div className="responsive-control-row" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Language Selector */}
            <div className="segmented-control"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.4rem 0.75rem',
                gap: '0.4rem',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Language:</span>
              <select
                value={language}
                onChange={(e) => handleDialectChange(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                  fontSize: '0.85rem',
                }}
              >
                <option value="ASL" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>ASL (American)</option>
                <option value="FSL" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>FSL (Filipino)</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsGuidanceOpen(true)}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Supported signs
            </button>

            {/* Mode Switcher Pills */}
            <div className="segmented-control translator-tabs"
              style={{
                display: 'flex',
                background: 'var(--bg-surface)',
                padding: '0.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--glass-border)',
                gap: '0.25rem',
              }}
            >
              <button
                className={`btn ${activeSubTab === 'sign-to-text' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveSubTab('sign-to-text')}
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem', border: 'none' }}
              >
                <Camera className="w-3.5 h-3.5" />
                Sign-to-Text
              </button>
              <button
                className={`btn ${activeSubTab === 'speech-to-sign' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveSubTab('speech-to-sign')}
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem', border: 'none' }}
              >
                <Mic className="w-3.5 h-3.5" />
                Speech/Text-to-Sign
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MODE 1: SIGN-TO-TEXT (Clean 2-Column Split Layout) */}
      {activeSubTab === 'sign-to-text' && (
        <div>
          {/* Translation Engine Mode Selector: Fingerspelling vs Conversational Phrases */}
          <div
            className="glass-card engine-selector"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.75rem 1.25rem',
              marginBottom: '1.5rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Active Engine:
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  background: 'var(--accent-glow)',
                  color: 'var(--accent-primary)',
                  border: '1px solid rgba(2, 132, 199, 0.3)',
                }}
              >
                {signMode === 'fingerspelling' ? ' Alphabet & Numbers Mode' : ' Conversational Phrases Mode'}
              </span>
            </div>

            <div className="segmented-control engine-modes"
              style={{
                display: 'flex',
                background: 'var(--bg-surface)',
                padding: '0.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--glass-border)',
                gap: '0.35rem',
              }}
            >
              <button
                type="button"
                id="btn-mode-fingerspelling"
                className={`btn ${signMode === 'fingerspelling' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSignMode('fingerspelling')}
                style={{
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.82rem',
                  fontWeight: signMode === 'fingerspelling' ? 700 : 500,
                  border: signMode === 'fingerspelling' ? 'none' : '1px solid transparent',
                }}
                title="Translate static letters (A-Z) and numbers (0-9) instantly without dynamic phrase interference"
              >
                Alphabet & Numbers (Fingerspelling)
              </button>
              <button
                type="button"
                id="btn-mode-phrases"
                className={`btn ${signMode === 'phrases' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSignMode('phrases')}
                style={{
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.82rem',
                  fontWeight: signMode === 'phrases' ? 700 : 500,
                  border: signMode === 'phrases' ? 'none' : '1px solid transparent',
                }}
                title="Translate full dynamic conversational signs (e.g. Hello, Thank You, Kumusta Ka Na, Salamat, Yes, No)"
              >
                Conversational Phrases (Dynamic)
              </button>
            </div>
          </div>

          <section className="responsive-two-column translator-workspace"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2.5rem',
              alignItems: 'start',
              marginBottom: '2.5rem',
            }}
          >
            {/* Left Column: Live Camera Viewport */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isCameraActive ? '#10b981' : '#ef4444',
                      boxShadow: isCameraActive ? '0 0 8px #10b981' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Webcam Feed ({language})
                  </span>
                </div>

                <button
                  className={`btn ${isCameraActive ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={toggleCamera}
                  style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
                >
                  {isCameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                  {isCameraActive ? 'Stop Camera' : 'Start Camera'}
                </button>
              </div>

              {/* Video Viewport Container */}
              <div className="camera-viewport"
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 'clamp(280px, 45vh, 420px)',
                  background: '#090d16',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  ref={videoRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                  }}
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transform: 'scaleX(-1)',
                    pointerEvents: 'none',
                  }}
                />

                {!isCameraActive && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '2rem',
                      zIndex: 2,
                      background: '#090d16',
                    }}
                  >
                    <Camera className="w-10 h-10 mx-auto mb-3 text-sky-400 opacity-80" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>
                      Camera Inactive
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '280px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                      Enable your camera to begin real-time sign recognition.
                    </p>
                    <button className="btn btn-primary" onClick={toggleCamera} style={{ fontSize: '0.85rem', padding: '0.55rem 1.25rem' }}>
                      Enable Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Minimal Status Line */}
              <div
                style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  {handPostureStatus}
                </span>
                {isCameraActive && confidence > 0 && (
                  <span style={{ color: '#34d399', fontWeight: 700 }}>
                    Confidence: {confidence}%
                  </span>
                )}
              </div>
            </div>

            {/* Right Column: Recognized Translation Output & Word Builder */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                    Recognized Translation
                  </h2>
                  <span className={`badge ${language === 'ASL' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.72rem' }}>
                    {language} to Text
                  </span>
                </div>

                {/* Large Output Typography Display */}
                <div
                  style={{
                    padding: '1.5rem 0',
                    borderTop: '1px solid var(--glass-border)',
                    borderBottom: '1px solid var(--glass-border)',
                    marginBottom: '1.25rem',
                    minHeight: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                    Live Recognized Sign:
                  </div>
                  <div style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {translatedText}
                  </div>

                  {detectedSign !== 'NONE' && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Detected Category:</span>
                      <span className="badge badge-amber" style={{ fontSize: '0.82rem', fontWeight: 800, padding: '0.25rem 0.65rem' }}>
                        {getHumanReadableSign(detectedSign, language)}
                      </span>
                      {isSignLocked && (
                        <span className="badge badge-green" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Locked & Steady
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Direct Action Controls */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => speakText(translatedText)}
                  style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
                >
                  <Volume2 className="w-4 h-4" />
                  Read Sign Aloud
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setTranslatedText('Waiting for gesture...');
                    setDetectedSign('NONE');
                    setConfidence(0);
                    setIsSignLocked(false);
                    lockedSignRef.current = 'NONE';
                    lockedScoreRef.current = 0;
                    dynamicHoldUntilRef.current = 0;
                    lastSpokenSignRef.current = 'NONE';
                    consecutiveCandidateRef.current = null;
                    consecutiveCandidateCountRef.current = 0;
                    lastProcessedStaticPredictionRef.current = 0;
                    sequencePredictionRef.current = null;
                    dynamicPredictionRef.current = null;
                    dynamicPredictionReadyRef.current = false;
                    dynamicAwaitingResultRef.current = false;
                    noHandFinishAttemptedRef.current = false;
                    inferenceGenerationRef.current += 1;
                    if (dynamicTrackerRef.current) dynamicTrackerRef.current.reset();
                    dynamicSegmenterRef.current.reset();
                  }}
                  style={{ padding: '0.75rem 1.15rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Translator
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. MODE 2: SPEECH & TEXT-TO-SIGN (Clean 2-Column Layout) */}
      {activeSubTab === 'speech-to-sign' && (() => {
        const activeCatalog = DATASET_CATALOG[language] || DATASET_CATALOG.ASL;

        return (
          <section className="responsive-two-column speech-sign-workspace"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2.5rem',
              alignItems: 'start',
              marginBottom: '2.5rem',
            }}
          >
            {/* Left Column: Input Controls */}
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                    Text or Speech to 3D Sign
                  </h2>
                  <span className={`badge ${language === 'ASL' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.72rem' }}>
                    {language} Dataset ({activeCatalog.phrases.length + activeCatalog.letters.length + activeCatalog.numbers.length} Signs)
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Type a word or phrase, or speak in {language === 'FSL' ? 'Filipino' : 'English'} to animate the lifelike 3D hands.
                </p>
              </div>

              {/* Input Box */}
              <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  <span>Input Word, Phrase or Speech ({language}):</span>
                  {inputMessage && (
                    <button
                      onClick={() => {
                        setInputMessage('');
                        setSignSequence([]);
                        setCurrentSequenceIndex(0);
                        setCurrentAnimatingWord('NONE');
                        setTranslationNotice('');
                        setAnimationToken((value) => value + 1);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', textTransform: 'none' }}
                    >
                      Clear
                    </button>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTriggerSign(inputMessage);
                    }}
                    placeholder={language === 'FSL' ? 'e.g. Kumusta, Salamat, Magandang Umaga, Enye, o mag-type ng salita' : 'e.g. Hello, Thank You, I Love You, or type any word'}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginTop: '0.55rem',
                    fontSize: '0.72rem',
                    color: translationNotice ? '#fbbf24' : 'var(--text-muted)',
                    lineHeight: 1.35,
                  }}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{translationNotice || 'Dataset-locked output: phrases use trained labels; other words are fingerspelled from trained letters.'}</span>
                </div>
              </div>

              {/* Generate Action Button */}
              <button
                className="btn btn-primary"
                onClick={() => handleTriggerSign(inputMessage)}
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}
              >
                <Sparkles className="w-4 h-4" />
                Generate 3D Sign Animation
              </button>

              {/* Speech Microphone Button */}
              <div style={{ marginBottom: '1.25rem' }}>
                <button
                  className={`btn ${isListening ? 'btn-secondary' : 'btn-outline'}`}
                  onClick={toggleSpeechRecognition}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    borderColor: isListening ? '#ef4444' : undefined,
                    color: isListening ? '#f87171' : undefined,
                  }}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isListening ? 'Stop Recording' : `Speak in ${language === 'FSL' ? 'Filipino (Tagalog)' : 'English'}`}
                </button>
                <span style={{ display: 'block', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  {speechStatus}
                </span>
              </div>
            </div>

            {/* Right Column: 3D Animated Hand Viewport & Controls */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.15rem 0' }}>
                    3D Hand Sign Viewport
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Active sign: <strong style={{ color: 'var(--accent-primary)' }}>"{currentAnimatingWord}"</strong> ({language})
                  </span>
                </div>

                {/* Playback Speed Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-surface)', padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>SPEED:</span>
                  {[0.75, 1.0, 1.5].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => {
                        setPlaybackSpeed(spd);
                        setAnimationToken((value) => value + 1);
                      }}
                      style={{
                        padding: '0.2rem 0.45rem',
                        fontSize: '0.7rem',
                        border: 'none',
                        borderRadius: '3px',
                        background: playbackSpeed === spd ? 'var(--accent-primary)' : 'transparent',
                        color: playbackSpeed === spd ? '#000' : 'var(--text-secondary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Phrase and fingerspelling sequence progress */}
              {signSequence.length > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.65rem',
                    padding: '0.45rem 0.75rem',
                    background: 'rgba(56, 189, 248, 0.1)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    overflowX: 'auto',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                    Sequence:
                  </span>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    {signSequence.map((step, idx) => {
                      const isActive = idx === currentSequenceIndex;
                      return (
                        <span
                          key={idx}
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            background: isActive ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                            color: isActive ? '#000' : 'var(--text-secondary)',
                            transform: isActive ? 'scale(1.15)' : 'scale(1.0)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {step.type === 'gap' ? '•' : step.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3D Viewport Container */}
              <div className="avatar-viewport"
                style={{
                  width: '100%',
                  height: 'clamp(300px, 48vh, 440px)',
                  background: '#090d16',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--glass-border)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading 3D signer...</div>}>
                  <Hand3D
                    currentWord={currentAnimatingWord}
                    language={language}
                    playbackSpeed={playbackSpeed}
                    animationToken={animationToken}
                  />
                </Suspense>
              </div>

              <div style={{ marginTop: '0.65rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Recorded training-dataset motion with body-relative placement and 3-phalanx articulation
              </div>
            </div>
          </section>
        );
      })()}

      {/* 3. Footer Utility Row (Matches HomePage) */}
      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--glass-border)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Private & On-Device — camera video is processed locally and never leaves your browser.</span>
        </div>
        <span style={{ fontSize: '0.75rem' }}>
          SignSync Dual-Engine AI
        </span>
      </footer>
    </div>
  );
}
