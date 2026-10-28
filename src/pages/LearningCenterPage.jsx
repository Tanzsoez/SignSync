import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Trophy,
  CheckCircle,
  CheckCircle2,
  Camera,
  X,
  Sparkles,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ALL_CURRICULUM_SIGNS } from '../data/curriculumData';
import SignGraphic from '../components/SignGraphic';
import { useModel } from '../contexts/ModelContext';
import { loadHolistic } from '../utils/loadHolistic';
import {
  HolisticTrackingStabilizer,
  isFreshHolisticResult,
  selectActiveHandObjects,
} from '../utils/holisticTracking';
import { cameraConstraints, getRuntimeProfile } from '../utils/runtimeProfile';
import RuntimeDiagnosticsPanel from '../components/RuntimeDiagnosticsPanel';
import { extractFeatures72 } from '../utils/landmarkFeatures';
import {
  AdaptiveInferenceController,
  cancelVideoFrame,
  RuntimeDiagnostics,
  scheduleVideoFrame,
} from '../utils/cameraRuntime';
import { drawCameraGuide, getHandPositionGuidance } from '../utils/cameraGuidance';

const INITIAL_RUNTIME_PROFILE = getRuntimeProfile();

export default function LearningCenterPage() {
  const { isModelLoaded, predictStatic } = useModel();

  // Curriculum filter & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All'); // 'All' | 'ASL Letters' | 'ASL Numbers' | 'FSL Letters' | 'FSL Numbers' | 'Mastered' | 'Practice'

  // Progress Tracking State (starts from 0 by default, persisted to localStorage)
  const [completedLessons, setCompletedLessons] = useState(() => {
    try {
      // Clear legacy pre-completed data on first load if present
      const hasInitZero = localStorage.getItem('signsync_zero_progress_initialized');
      if (!hasInitZero) {
        localStorage.setItem('signsync_zero_progress_initialized', 'true');
        localStorage.setItem('signsync_completed_lessons', JSON.stringify([]));
        return [];
      }

      const saved = localStorage.getItem('signsync_completed_lessons');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  // The shared ModelContext loads and caches the quantized sequence GRU.

  // "Copy the Sign" Interactive Webcam Modal State
  const [activePracticeSign, setActivePracticeSign] = useState(null);
  const isPracticeOpen = Boolean(activePracticeSign);
  const [cameraError, setCameraError] = useState(null);

  // Live posture verification feedback state
  const [verificationStatus, setVerificationStatus] = useState('idle'); // 'idle' | 'detecting' | 'correct' | 'incorrect' | 'mastered'
  const [verificationFeedback, setVerificationFeedback] = useState('Place your hand in front of camera to copy the sign.');
  const [detectedSignName, setDetectedSignName] = useState('None');
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [positioningGuidance, setPositioningGuidance] = useState({ level: 'waiting', message: 'Place your hand inside the guide' });

  // Webcam & Canvas Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const holisticRef = useRef(null);
  const holisticStabilizerRef = useRef(new HolisticTrackingStabilizer());
  const latestHolisticResultsRef = useRef(null);
  const isProcessingHolisticRef = useRef(false);
  const activePracticeSignRef = useRef(null);
  const animFrameRef = useRef(null);
  const isCameraLoopActiveRef = useRef(false);
  const holdStartTimeRef = useRef(null);
  const hasMasteredCurrentRef = useRef(false);
  const sequencePredictionRef = useRef(null);
  const sequenceInferenceBusyRef = useRef(false);
  const lastSequenceInferenceRef = useRef(0);
  const inferenceGenerationRef = useRef(0);
  const lastQueuedHolisticTimestampRef = useRef(0);
  const practiceCameraPanelRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const runtimeProfileRef = useRef(INITIAL_RUNTIME_PROFILE);
  const adaptiveInferenceRef = useRef(new AdaptiveInferenceController(INITIAL_RUNTIME_PROFILE));
  const runtimeDiagnosticsRef = useRef(new RuntimeDiagnostics('learning', INITIAL_RUNTIME_PROFILE));
  const holisticStartedAtRef = useRef(0);
  const holisticCaptureAtRef = useRef(0);
  const lastHolisticSubmitRef = useRef(0);
  const lastDiagnosticsPublishRef = useRef(0);
  const lastDisplayFrameRef = useRef(0);
  const pageVisibleRef = useRef(!document.hidden);

  // Persist progress to localStorage
  useEffect(() => {
    localStorage.setItem('signsync_completed_lessons', JSON.stringify(completedLessons));
  }, [completedLessons]);


  // Use the same Holistic landmark source as the recording studio.
  useEffect(() => {
    let isMounted = true;
    if (!isPracticeOpen) return undefined;
    async function initHandTrackingEngines() {
      try {
        await loadHolistic();
      } catch (err) {
        console.warn('[LearningCenter] Holistic download error:', err);
      }
      if (window.Holistic && isMounted) {
        try {
          const holistic = new window.Holistic({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
          });
          const profile = getRuntimeProfile();
          runtimeProfileRef.current = profile;
          adaptiveInferenceRef.current = new AdaptiveInferenceController(profile);
          runtimeDiagnosticsRef.current = new RuntimeDiagnostics('learning', profile);
          holistic.setOptions({
            modelComplexity: profile.holisticModelComplexity,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            refineFaceLandmarks: profile.refineFaceLandmarks,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.55,
          });
          holistic.onResults((results) => {
            if (results) {
              const completedAt = performance.now();
              const latency = holisticStartedAtRef.current
                ? completedAt - holisticStartedAtRef.current
                : 0;
              adaptiveInferenceRef.current.recordLatency(latency);
              runtimeDiagnosticsRef.current.recordHolisticLatency(latency);
              runtimeDiagnosticsRef.current.recordLandmarks(completedAt);
              latestHolisticResultsRef.current = holisticStabilizerRef.current.update(
                results, holisticCaptureAtRef.current || Date.now(),
              );
            }
          });
          holisticRef.current = holistic;
        } catch (e) {
          console.warn('[LearningCenter] Holistic initialization error:', e);
        }
      }
    }
    initHandTrackingEngines();
    return () => {
      isMounted = false;
      holisticStabilizerRef.current.reset();
      holisticRef.current?.close?.();
      holisticRef.current = null;
    };
  }, [isPracticeOpen]);

  useEffect(() => {
    const handleVisibility = () => {
      pageVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => () => {
    isCameraLoopActiveRef.current = false;
    if (animFrameRef.current) cancelVideoFrame(videoRef.current, animFrameRef.current);
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  // Stats computation
  const totalSignsCount = ALL_CURRICULUM_SIGNS.length; // 72
  const masteredCount = ALL_CURRICULUM_SIGNS.filter((s) => completedLessons.includes(s.signKey)).length;
  const progressPercent = Math.round((masteredCount / totalSignsCount) * 100);

  const aslMasteredCount = ALL_CURRICULUM_SIGNS.filter((s) => s.dialect === 'ASL' && completedLessons.includes(s.signKey)).length;
  const fslMasteredCount = ALL_CURRICULUM_SIGNS.filter((s) => s.dialect === 'FSL' && completedLessons.includes(s.signKey)).length;

  // Dynamic Multi-Token Search & Category Filter
  const filteredSigns = ALL_CURRICULUM_SIGNS.filter((sign) => {
    // 1. Category Filter Chip
    let matchesCategory = true;
    if (selectedFilter === 'ASL Letters') matchesCategory = sign.dialect === 'ASL' && sign.type === 'Letter';
    else if (selectedFilter === 'ASL Numbers') matchesCategory = sign.dialect === 'ASL' && sign.type === 'Number';
    else if (selectedFilter === 'FSL Letters') matchesCategory = sign.dialect === 'FSL' && sign.type === 'Letter';
    else if (selectedFilter === 'FSL Numbers') matchesCategory = sign.dialect === 'FSL' && sign.type === 'Number';
    else if (selectedFilter === 'Mastered') matchesCategory = completedLessons.includes(sign.signKey);
    else if (selectedFilter === 'Practice') matchesCategory = !completedLessons.includes(sign.signKey);

    // 2. Multi-Token Search query match
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesCategory;

    // Tokens split by space (e.g. "fsl a", "asl 5", "letter c")
    const tokens = q.split(/\s+/).filter(Boolean);

    const symbol = sign.symbol.toLowerCase();
    const title = sign.title.toLowerCase();
    const dialect = sign.dialect.toLowerCase();
    const type = sign.type.toLowerCase();
    const signKey = sign.signKey.toLowerCase();
    const description = sign.description.toLowerCase();
    const hint = sign.hint.toLowerCase();

    // Check if every token matches the sign
    const matchesAllTokens = tokens.every((token) => {
      // Single character token (e.g. "a", "5", "ñ")
      if (token.length === 1) {
        const normToken = token.replace(/ñ/g, 'n');
        const normSymbol = symbol.replace(/ñ/g, 'n');
        return symbol === token || normSymbol === normToken;
      }

      // Word token (e.g. "fsl", "asl", "letter", "number", "peace", "fist")
      return (
        title.includes(token) ||
        dialect === token ||
        type.toLowerCase().includes(token) ||
        signKey.includes(token) ||
        hint.includes(token) ||
        description.includes(token)
      );
    });

    return matchesCategory && matchesAllTokens;
  });

  // Open "Copy the Sign" modal for a selected sign
  const handleOpenPracticeModal = (sign) => {
    setActivePracticeSign(sign);
    activePracticeSignRef.current = sign;
    setVerificationStatus('idle');
    setVerificationFeedback(`Copy the hand sign for ${sign.title}. Look at the guide on the left.`);
    setDetectedSignName('None');
    setDetectionConfidence(0);
    setHoldProgress(0);
    sequencePredictionRef.current = null;
    inferenceGenerationRef.current += 1;
    hasMasteredCurrentRef.current = completedLessons.includes(sign.signKey);
    requestAnimationFrame(() => {
      practiceCameraPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      practiceCameraPanelRef.current?.focus({ preventScroll: true });
      startWebcam();
    });
  };

  // Close "Copy the Sign" modal
  const handleClosePracticeModal = () => {
    stopWebcam();
    setActivePracticeSign(null);
    activePracticeSignRef.current = null;
    setVerificationStatus('idle');
    setHoldProgress(0);
    sequencePredictionRef.current = null;
    inferenceGenerationRef.current += 1;
  };

  // Switch to next sign in curriculum
  const handleNextSign = () => {
    const currentSign = activePracticeSignRef.current || activePracticeSign;
    if (!currentSign) return;
    const currentIndex = ALL_CURRICULUM_SIGNS.findIndex((s) => s.id === currentSign.id);
    const nextIndex = (currentIndex + 1) % ALL_CURRICULUM_SIGNS.length;
    const nextSign = ALL_CURRICULUM_SIGNS[nextIndex];
    setActivePracticeSign(nextSign);
    activePracticeSignRef.current = nextSign;
    setVerificationStatus('idle');
    setVerificationFeedback(`Copy the hand sign for ${nextSign.title}.`);
    setDetectedSignName('None');
    setDetectionConfidence(0);
    setHoldProgress(0);
    sequencePredictionRef.current = null;
    inferenceGenerationRef.current += 1;
    hasMasteredCurrentRef.current = completedLessons.includes(nextSign.signKey);
  };

  // Start Webcam
  const startWebcam = async () => {
    setCameraError(null);
    try {
      if (mediaStreamRef.current) return;
      const profile = getRuntimeProfile();
      runtimeProfileRef.current = profile;
      adaptiveInferenceRef.current = new AdaptiveInferenceController(profile);
      runtimeDiagnosticsRef.current = new RuntimeDiagnostics('learning', profile);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraConstraints(profile),
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          isCameraLoopActiveRef.current = true;
          runCameraDetectionLoop();
        };
      }
    } catch (err) {
      console.warn('Webcam permission error:', err);
      setCameraError('Camera access denied or unavailable. Please enable webcam permissions in your browser.');
    }
  };

  // Stop Webcam
  const stopWebcam = () => {
    isCameraLoopActiveRef.current = false;
    isProcessingHolisticRef.current = false;
    if (animFrameRef.current) {
      cancelVideoFrame(videoRef.current, animFrameRef.current);
      animFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    latestHolisticResultsRef.current = null;
    holisticStabilizerRef.current.reset();
    sequencePredictionRef.current = null;
    inferenceGenerationRef.current += 1;
  };

  const schedulePracticeInference = (features, dialect, nowInMs) => {
    if (!isModelLoaded || sequenceInferenceBusyRef.current) return;
    if (nowInMs - lastSequenceInferenceRef.current < 65) return;
    lastSequenceInferenceRef.current = nowInMs;
    sequenceInferenceBusyRef.current = true;
    const inferenceStartedAt = performance.now();
    const generation = inferenceGenerationRef.current;
    predictStatic(features, dialect)
      .then((prediction) => {
        runtimeDiagnosticsRef.current.recordPrediction(prediction, 'practice');
        if (generation === inferenceGenerationRef.current) {
          sequencePredictionRef.current = prediction
            ? { ...prediction, timestamp: performance.now() }
            : null;
        }
      })
      .catch((error) => console.warn('[LearningCenter] GRU inference failed:', error))
      .finally(() => {
        runtimeDiagnosticsRef.current.recordModelLatency(performance.now() - inferenceStartedAt);
        sequenceInferenceBusyRef.current = false;
      });
  };

  // Draw hand bones & joints on canvas
  const drawHandSkeleton = (ctx, handPts, isCorrect) => {
    const HAND_CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17],
    ];

    const boneColor = isCorrect ? '#34d399' : '#38bdf8';
    const jointColor = isCorrect ? '#10b981' : '#0284c7';
    const tipColor = isCorrect ? '#a7f3d0' : '#f59e0b';

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = boneColor;

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

    handPts.forEach((pt, idx) => {
      ctx.beginPath();
      const isTip = [4, 8, 12, 16, 20].includes(idx);
      ctx.fillStyle = isTip ? tipColor : jointColor;
      ctx.arc(pt.x * ctx.canvas.width, pt.y * ctx.canvas.height, isTip ? 5.5 : 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  // Live video frame processing loop
  const runCameraDetectionLoop = () => {
    if (!isCameraLoopActiveRef.current) return;

    const nowInMs = Date.now();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const activeSign = activePracticeSignRef.current || activePracticeSign;

    if (video && canvas && video.readyState >= 2 && activeSign) {
      const profile = runtimeProfileRef.current;
      if (!pageVisibleRef.current || nowInMs - lastDisplayFrameRef.current < profile.displayIntervalMs) {
        animFrameRef.current = scheduleVideoFrame(video, runCameraDetectionLoop);
        return;
      }
      lastDisplayFrameRef.current = nowInMs;
      const videoWidth = video.videoWidth || profile.cameraWidth;
      const videoHeight = video.videoHeight || profile.cameraHeight;
      if (canvas.width !== videoWidth) canvas.width = videoWidth;
      if (canvas.height !== videoHeight) canvas.height = videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCameraGuide(ctx);
      runtimeDiagnosticsRef.current.recordVideo(video);

      // Send to Holistic at a device-appropriate cadence.
      if (
        holisticRef.current && isProcessingHolisticRef.current &&
        nowInMs - lastHolisticSubmitRef.current > adaptiveInferenceRef.current.inferenceIntervalMs
      ) {
        runtimeDiagnosticsRef.current.recordDroppedSubmission();
      }
      if (
        holisticRef.current &&
        !isProcessingHolisticRef.current &&
        nowInMs - lastHolisticSubmitRef.current > adaptiveInferenceRef.current.inferenceIntervalMs
      ) {
        isProcessingHolisticRef.current = true;
        holisticStartedAtRef.current = performance.now();
        holisticCaptureAtRef.current = nowInMs;
        lastHolisticSubmitRef.current = nowInMs;
        try {
          holisticRef.current
            .send({ image: video })
            .catch(() => { })
            .finally(() => {
              isProcessingHolisticRef.current = false;
            });
        } catch {
          isProcessingHolisticRef.current = false;
        }
      }

      let detectedHands = [];
      if (isFreshHolisticResult(
        latestHolisticResultsRef.current,
        nowInMs,
        adaptiveInferenceRef.current.freshnessBudgetMs,
      )) {
        const hRes = latestHolisticResultsRef.current;
        detectedHands = selectActiveHandObjects(hRes).map((hand) => hand.landmarks);
      }
      const nextGuidance = getHandPositionGuidance(detectedHands);
      setPositioningGuidance((current) => (
        current.level === nextGuidance.level && current.message === nextGuidance.message ? current : nextGuidance
      ));

      if (detectedHands.length > 0) {
        const handLandmarks = detectedHands[0];
        const features = extractFeatures72(handLandmarks);
        const holisticTimestamp = latestHolisticResultsRef.current?._timestamp || 0;
        if (features && holisticTimestamp > lastQueuedHolisticTimestampRef.current) {
          lastQueuedHolisticTimestampRef.current = holisticTimestamp;
          schedulePracticeInference(features, activeSign.dialect, nowInMs);
        }
        const latestPrediction = sequencePredictionRef.current;
        const prediction = latestPrediction && performance.now() - latestPrediction.timestamp < 600
          ? { signKey: latestPrediction.label, score: latestPrediction.score }
          : null;

        if (prediction && prediction.signKey) {
          let normalizedPredictedKey = prediction.signKey;
          if (normalizedPredictedKey.includes('Ã‘') || normalizedPredictedKey.includes('Ã\x91') || normalizedPredictedKey.includes('\u00c3\u2018')) {
            normalizedPredictedKey = normalizedPredictedKey.replace(/Ã‘|Ã\x91|\u00c3\u2018/g, 'Ñ');
          }
          const isMatch = normalizedPredictedKey === activeSign.signKey && prediction.score >= 50;
          drawHandSkeleton(ctx, handLandmarks, isMatch);

          const signSymbol = normalizedPredictedKey.replace(/^(ASL_|FSL_)/, '');
          setDetectedSignName(signSymbol);
          setDetectionConfidence(prediction.score);

          if (isMatch) {
            // Posture correctly matches target sign!
            setVerificationStatus('correct');
            setVerificationFeedback('🟢 Excellent posture match! Hold steady to master this sign...');

            // Advance hold progress
            if (!holdStartTimeRef.current) {
              holdStartTimeRef.current = Date.now();
            }

            const elapsed = Date.now() - holdStartTimeRef.current;
            const progress = Math.min(100, Math.round((elapsed / 1200) * 100)); // 1.2s hold
            setHoldProgress(progress);

            if (progress >= 100 && !hasMasteredCurrentRef.current) {
              hasMasteredCurrentRef.current = true;
              setVerificationStatus('mastered');
              setVerificationFeedback(`🎉 Mastery Achieved! Correctly copied ${activeSign.title}!`);

              // Trigger confetti celebration
              confetti({
                particleCount: 90,
                spread: 70,
                origin: { y: 0.6 },
              });

              // Automatically add to progress tracking!
              setCompletedLessons((prev) => {
                if (!prev.includes(activeSign.signKey)) {
                  return [...prev, activeSign.signKey];
                }
                return prev;
              });
            }
          } else {
            // Incorrect posture!
            holdStartTimeRef.current = null;
            setHoldProgress(0);
            setVerificationStatus('incorrect');
            setVerificationFeedback(
              `❌ Incorrect posture: Currently detected as '${signSymbol}' (${prediction.score}% match) instead of '${activeSign.symbol}'. ${activeSign.hint}`
            );
          }
        } else {
          // Hand detected but classifier aligning
          holdStartTimeRef.current = null;
          setHoldProgress(0);
          setVerificationStatus('detecting');
          setVerificationFeedback(`Hand detected. Adjust fingers to match '${activeSign.symbol}'.`);
          setDetectedSignName('Aligning...');
          setDetectionConfidence(prediction ? prediction.score : 0);
          drawHandSkeleton(ctx, handLandmarks, false);
        }
      } else {
        // No hand visible
        sequencePredictionRef.current = null;
        inferenceGenerationRef.current += 1;
        holdStartTimeRef.current = null;
        setHoldProgress(0);
        setVerificationStatus('detecting');
        setVerificationFeedback('👋 Place your hand in front of the camera to copy the sign.');
        setDetectedSignName('None');
        setDetectionConfidence(0);
      }
    }

    if (isCameraLoopActiveRef.current) {
      runtimeDiagnosticsRef.current.recordDisplay();
      if (nowInMs - lastDiagnosticsPublishRef.current >= 2000) {
        lastDiagnosticsPublishRef.current = nowInMs;
        runtimeDiagnosticsRef.current.publish(adaptiveInferenceRef.current);
      }
      animFrameRef.current = scheduleVideoFrame(videoRef.current, runCameraDetectionLoop);
    }
  };

  // Reset Progress Handler
  const handleResetProgress = () => {
    if (window.confirm('Are you sure you want to reset your curriculum progress?')) {
      setCompletedLessons([]);
      localStorage.removeItem('signsync_completed_lessons');
    }
  };

  return (
    <div className="fade-in responsive-page learning-page">
      <RuntimeDiagnosticsPanel source="learning" />
      {/* Top Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="responsive-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BookOpen className="w-8 h-8 text-sky-400" />
              Learning Center: Letters & Numbers
            </h1>
            <p className="page-subtitle">
              Master ASL and FSL alphabets (A–Z) and numbers (0–9). Tap any sign image to copy it live with real-time AI hand detection.
            </p>
          </div>
          <div className="responsive-control-row" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button
              onClick={handleResetProgress}
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="Reset curriculum progress"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Progress
            </button>
          </div>
        </div>
      </div>

      {/* Progress Dashboard Banner */}
      <div
        className="glass-card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--glass-border-hover)',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 14px var(--accent-glow)',
              }}
            >
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Progress Tracking
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                ASL & FSL Letters & Numbers Curriculum (73 Signs)
              </span>
            </div>
          </div>

          <div className="learning-stats" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--glass-border)',
                padding: '0.55rem 1rem',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                minWidth: '110px',
              }}
            >
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
                Total Mastered
              </span>
              <strong style={{ fontSize: '1.35rem', color: 'var(--success)', fontWeight: 800 }}>
                {masteredCount} / {totalSignsCount}
              </strong>
            </div>

            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--glass-border)',
                padding: '0.55rem 1rem',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                minWidth: '100px',
              }}
            >
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
                Mastery %
              </span>
              <strong style={{ fontSize: '1.35rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
                {progressPercent}%
              </strong>
            </div>

            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--glass-border)',
                padding: '0.55rem 1rem',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                minWidth: '100px',
              }}
            >
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
                ASL Mastery
              </span>
              <strong style={{ fontSize: '1.15rem', color: '#38bdf8', fontWeight: 800 }}>
                {aslMasteredCount} / 36
              </strong>
            </div>

            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--glass-border)',
                padding: '0.55rem 1rem',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                minWidth: '100px',
              }}
            >
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
                FSL Mastery
              </span>
              <strong style={{ fontSize: '1.15rem', color: '#34d399', fontWeight: 800 }}>
                {fslMasteredCount} / 37
              </strong>
            </div>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
            <span>Curriculum Completion</span>
            <span style={{ color: 'var(--accent-primary)' }}>{progressPercent}% Complete</span>
          </div>

          <div
            style={{
              width: '100%',
              height: '10px',
              background: 'rgba(2, 132, 199, 0.12)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #34d399 100%)',
                transition: 'width 0.5s ease',
                borderRadius: 'var(--radius-full)',
                boxShadow: '0 0 12px var(--accent-glow)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Search & Category Filter Chips */}
      <div className="learning-filters" style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search className="w-4 h-4" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search signs (e.g. FSL A, ASL 5, B, Fist, Peace)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 2.2rem 0.65rem 2.5rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: '0.9rem',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.2rem',
              }}
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: `All Signs (${totalSignsCount})`, key: 'All' },
            { label: 'ASL Letters (26)', key: 'ASL Letters' },
            { label: 'ASL Numbers (10)', key: 'ASL Numbers' },
            { label: 'FSL Letters (27)', key: 'FSL Letters' },
            { label: 'FSL Numbers (10)', key: 'FSL Numbers' },
            { label: `Mastered (${masteredCount})`, key: 'Mastered' },
            { label: `Needs Practice (${totalSignsCount - masteredCount})`, key: 'Practice' },
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => setSelectedFilter(chip.key)}
              className={`btn ${selectedFilter === chip.key ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {searchQuery && (
        <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Showing <strong>{filteredSigns.length}</strong> matching signs for "{searchQuery}"</span>
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Curriculum Grid: 72 Signs */}
      <div className="curriculum-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {filteredSigns.map((item) => {
          const isMastered = completedLessons.includes(item.signKey);
          const isASL = item.dialect === 'ASL';

          return (
            <div
              key={item.id}
              className="glass-card hover-lift"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                border: `1px solid ${isMastered ? 'rgba(16, 185, 129, 0.4)' : 'var(--glass-border)'}`,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
              onClick={() => handleOpenPracticeModal(item)}
            >
              {/* Card Header Badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span className={`badge ${isASL ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.7rem' }}>
                  {item.dialect} {item.type}
                </span>

                {isMastered ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--success)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'rgba(16, 185, 129, 0.12)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Mastered
                  </span>
                ) : (
                  <span
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    Needs Practice
                  </span>
                )}
              </div>

              {/* Hand Posture Reference Image / Visual Graphic */}
              <div
                style={{
                  marginBottom: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <SignGraphic
                  signKey={item.signKey}
                  symbol={item.symbol}
                  dialect={item.dialect}
                  handShape={item.handShape}
                  size={165}
                  isMastered={isMastered}
                />
              </div>

              {/* Sign Title & Info */}
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: '1.35',
                }}
              >
                {item.description}
              </p>
            </div>
          );
        })}
      </div>

      {filteredSigns.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-muted" />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No signs found matching your search.</p>
          <button className="btn btn-outline" style={{ marginTop: '0.8rem' }} onClick={() => { setSearchQuery(''); setSelectedFilter('All'); }}>
            Clear Filters
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* INTERACTIVE "COPY THE SIGN" HAND DETECTION PRACTICE MODAL */}
      {/* ======================================================== */}
      {activePracticeSign && (
        <div className="practice-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClosePracticeModal();
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.3) 20%, rgba(15, 23, 42, 0.5) 100%)',
            backdropFilter: 'blur(70px) saturate(160%)',
            WebkitBackdropFilter: 'blur(70px) saturate(160%)',
            boxShadow: 'inset 0 0 160px 80px rgba(0, 0, 0, 0.25)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2.5rem 1.25rem 1.5rem 1.25rem',
            overflowY: 'auto',
          }}
        >
          <div
            className="glass-card fade-in practice-dialog"
            style={{
              maxWidth: '920px',
              width: '100%',
              maxHeight: 'calc(100vh - 4.5rem)',
              overflowY: 'auto',
              position: 'relative',
              background: 'var(--bg-surface)',
              border: '1px solid var(--glass-border-hover)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: '0 25px 65px -10px rgba(0, 0, 0, 0.45), 0 0 60px -5px rgba(2, 132, 199, 0.16)',
            }}
          >
            {/* Modal Header */}
            <div className="practice-dialog-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--glass-border)',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`badge ${activePracticeSign.dialect === 'ASL' ? 'badge-blue' : 'badge-green'}`}>
                  {activePracticeSign.dialect} {activePracticeSign.type}
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                  Copy the Sign: {activePracticeSign.title}
                </h2>
              </div>
              <button
                className="btn btn-outline"
                onClick={handleClosePracticeModal}
                style={{ padding: '0.4rem 0.65rem' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Screen Layout: Left = Target Reference Image; Right = Live Webcam Detection */}
            <div className="practice-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              {/* Left Column: Target Sign Guide */}
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Reference Posture
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
                    Target: {activePracticeSign.symbol}
                  </span>
                </div>

                {/* Reference Anatomy Graphic */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <SignGraphic
                    signKey={activePracticeSign.signKey}
                    symbol={activePracticeSign.symbol}
                    dialect={activePracticeSign.dialect}
                    handShape={activePracticeSign.handShape}
                    size={210}
                    isMastered={completedLessons.includes(activePracticeSign.signKey)}
                    showPromptBadge={false}
                  />
                </div>

                {/* Finger Placement Instructions */}
                <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                    Finger Positioning:
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    {activePracticeSign.description}
                  </p>
                </div>

                {/* Pro Tip */}
                <div style={{ background: 'rgba(2, 132, 199, 0.08)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    💡 Tip: {activePracticeSign.hint}
                  </span>
                </div>
              </div>

              {/* Right Column: Live Webcam Stream & Skeleton Overlay */}
              <div
                ref={practiceCameraPanelRef}
                className="practice-camera-panel"
                tabIndex={-1}
                style={{
                  background: 'var(--bg-primary)',
                  border: `2px solid ${verificationStatus === 'mastered' || verificationStatus === 'correct'
                      ? 'var(--success)'
                      : verificationStatus === 'incorrect'
                        ? '#ef4444'
                        : 'var(--glass-border)'
                    }`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Live AI Hand Detection
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Detected: <strong>{detectedSignName}</strong> ({detectionConfidence}%)
                    </span>
                  </div>
                </div>

                {/* Video & Canvas Viewport */}
                <div className="camera-viewport practice-camera-viewport"
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 'clamp(300px, 52vh, 520px)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: '#090d16',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Camera Video (mirrored for natural POV) */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                    }}
                  />

                  {/* Real-time Hand Skeleton Overlay Canvas */}
                  <canvas
                    ref={canvasRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Camera Error Display */}
                  {cameraError && (
                    <div
                      style={{
                        position: 'absolute',
                        padding: '1rem',
                        textAlign: 'center',
                        color: '#f87171',
                        fontSize: '0.85rem',
                        background: 'rgba(15, 23, 42, 0.9)',
                      }}
                    >
                      <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                      {cameraError}
                      <button className="btn btn-outline" style={{ marginTop: '0.75rem', fontSize: '0.75rem' }} onClick={startWebcam}>
                        <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                      </button>
                    </div>
                  )}
                </div>

                <div className={`camera-guidance camera-guidance-${positioningGuidance.level}`} role="status" aria-live="polite">
                  <span className="camera-guidance-dot" />
                  {positioningGuidance.message}
                </div>

                {/* Real-Time Posture Hold Progress */}
                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <span style={{ color: verificationStatus === 'correct' || verificationStatus === 'mastered' ? 'var(--success)' : 'var(--text-muted)' }}>
                      {verificationStatus === 'mastered'
                        ? 'Mastery Confirmed!'
                        : verificationStatus === 'correct'
                          ? 'Holding Correct Posture...'
                          : 'Hold Required: 1.2s'}
                    </span>
                    <span style={{ color: verificationStatus === 'correct' || verificationStatus === 'mastered' ? 'var(--success)' : 'var(--text-muted)' }}>
                      {holdProgress}%
                    </span>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${holdProgress}%`,
                        height: '100%',
                        background: verificationStatus === 'incorrect' ? '#ef4444' : 'var(--success)',
                        transition: 'width 0.1s linear',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Status / Feedback Message Bar */}
            <div
              style={{
                padding: '0.85rem 1.15rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                background:
                  verificationStatus === 'mastered' || verificationStatus === 'correct'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : verificationStatus === 'incorrect'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'var(--bg-primary)',
                border: `1px solid ${verificationStatus === 'mastered' || verificationStatus === 'correct'
                    ? 'rgba(16, 185, 129, 0.35)'
                    : verificationStatus === 'incorrect'
                      ? 'rgba(239, 68, 68, 0.35)'
                      : 'var(--glass-border)'
                  }`,
                color:
                  verificationStatus === 'mastered' || verificationStatus === 'correct'
                    ? '#34d399'
                    : verificationStatus === 'incorrect'
                      ? '#f87171'
                      : 'var(--text-primary)',
              }}
            >
              {verificationStatus === 'mastered' ? (
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : verificationStatus === 'correct' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : verificationStatus === 'incorrect' ? (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              ) : (
                <Camera className="w-5 h-5 text-sky-400 shrink-0" />
              )}
              <span>{verificationFeedback}</span>
            </div>

            {/* Modal Bottom Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {completedLessons.includes(activePracticeSign.signKey) && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: 'var(--success)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Sign Added to Progress Tracking!
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  className="btn btn-outline"
                  onClick={handleClosePracticeModal}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  Done Practicing
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleNextSign}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1.15rem' }}
                >
                  Next Sign <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
