import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DATASET_CATALOG } from '../data/signCatalog';
import { getRuntimeProfile } from '../utils/runtimeProfile';
import { getLetterMotionOffset, getRecordedPlaybackProgress } from '../utils/avatarMotion';

const normalizeDatasetKey = (value = '') => value
  .trim()
  .replace(/^(ASL_|FSL_)/i, '')
  .toUpperCase();

const DATASET_SIGN_KEYS = new Set(
  Object.values(DATASET_CATALOG).flatMap((catalog) => [
    ...catalog.letters,
    ...catalog.numbers,
    ...catalog.phrases.map((phrase) => phrase.key),
  ]).map(normalizeDatasetKey),
);

// These signs intentionally use both hands. Every other catalog sign keeps a
// quiet support hand out of the way so the active sign reads clearly.
const TWO_HAND_DATASET_SIGNS = new Set([
  'MORE',
  'GOOD',
  'MORNING',
  'AFTERNOON',
  'THANK_YOU',
  'PEOPLE',
  'MGA_TAO',
  "WHAT'S_UP",
  'KUMUSTA_KA_NA',
  'MAGANDANG_ARAW',
  'SALAMAT',
  'AYOS_LANG',
  'ANO_ANG_PANGALAN_MO',
  'ANG_PANGALAN_KO_AY',
]);

const isDatasetSign = (value) => {
  const key = normalizeDatasetKey(value);
  return /^[A-Z0-9]$/.test(key) || key === 'Ã‘' || DATASET_SIGN_KEYS.has(key);
};

export default function Hand3D({
  currentWord = '',
  language = 'ASL',
  playbackSpeed = 1.0,
  animationToken = 0,
  minHeight = '340px',
}) {
  const mountRef = useRef(null);
  const currentWordRef = useRef(currentWord);
  const languageRef = useRef(language);
  const playbackSpeedRef = useRef(playbackSpeed);
  const animationTokenRef = useRef(animationToken);
  const poseLibraryRef = useRef(null);
  const poseLibraryStatusRef = useRef('loading');
  const [poseLibraryStatus, setPoseLibraryStatus] = useState('loading');

  useEffect(() => {
    currentWordRef.current = currentWord;
    languageRef.current = language;
    playbackSpeedRef.current = playbackSpeed;
    animationTokenRef.current = animationToken;
  }, [currentWord, language, playbackSpeed, animationToken]);

  useEffect(() => {
    let active = true;
    fetch('/models/avatar_poses.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((library) => {
        if (library?.schemaVersion !== 2) throw new Error('Unsupported pose-library schema');
        if (active) {
          poseLibraryRef.current = library;
          poseLibraryStatusRef.current = 'ready';
          setPoseLibraryStatus('ready');
        }
      })
      .catch((error) => {
        console.warn('[Hand3D] Recorded pose library unavailable:', error);
        if (active) {
          poseLibraryStatusRef.current = 'fallback';
          setPoseLibraryStatus('fallback');
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;
    const runtimeProfile = getRuntimeProfile();

    // 1. Three.js Scene Setup in First-Person POV Perspective
    const scene = new THREE.Scene();
    scene.background = null;

    // POV Camera: Positioned slightly above and behind wrist level looking forward/down at hands
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
    camera.position.set(0, 0.15, 6.4);
    camera.lookAt(0, 0.15, 0);

    // 2. High-Fidelity WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, runtimeProfile.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 3. Cinematic Natural Studio Three-Point Lighting
    const ambientLight = new THREE.AmbientLight(0xfff6f0, 0.85);
    scene.add(ambientLight);

    // Warm Key Light (Front-Right)
    const keyLight = new THREE.DirectionalLight(0xfff2ea, 1.4);
    keyLight.position.set(4, 6, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Soft Fill Light (Front-Left)
    const fillLight = new THREE.DirectionalLight(0xe8f0fe, 0.85);
    fillLight.position.set(-4, 5, 5);
    scene.add(fillLight);

    // Subtle Rim / Backlight for Subsurface Skin Glow
    const rimLight = new THREE.DirectionalLight(0xffebd9, 1.1);
    rimLight.position.set(0, 7, -4);
    scene.add(rimLight);

    // Warm Under-Glow Bounce Light
    const bounceLight = new THREE.PointLight(0xfcd34d, 0.45, 10);
    bounceLight.position.set(0, -3, 3);
    scene.add(bounceLight);

    // Root POV Hands Group
    const povHandsGroup = new THREE.Group();
    scene.add(povHandsGroup);

    // 4. Uniform Realistic Skin Materials (EXACT SAME COLOR FOR BOTH HANDS)
    const skinColor = 0xd89d79; // Natural organic warm skin tone
    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.42,
      metalness: 0.04,
    });

    const knuckleMat = new THREE.MeshStandardMaterial({
      color: 0xc68764, // Realistic crease/knuckle skin fold tone
      roughness: 0.52,
      metalness: 0.03,
    });

    const nailMat = new THREE.MeshStandardMaterial({
      color: 0xe2b9a4, // Natural keratin tone without high-contrast white bars
      roughness: 0.38,
      metalness: 0.03,
    });

    const palmPadMat = new THREE.MeshStandardMaterial({
      color: 0xd29471, // Fleshy thenar/hypothenar pad tone
      roughness: 0.46,
      metalness: 0.02,
    });

    // Upper-body context makes body-relative signs readable: the signer now
    // has stable face, shoulder and chest anchors instead of floating hands.
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x17324d, roughness: 0.72, metalness: 0.02 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.55 });
    const avatarGroup = new THREE.Group();
    avatarGroup.position.z = -0.7;
    scene.add(avatarGroup);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.45, 1.45, 8, 24), shirtMat);
    torso.scale.set(1.18, 1, 0.52);
    torso.position.set(0, -0.55, 0);
    avatarGroup.add(torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.6, 20), skinMat);
    neck.position.set(0, 0.78, 0.02);
    avatarGroup.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 24), skinMat);
    head.scale.set(0.88, 1.08, 0.78);
    head.position.set(0, 1.55, 0.04);
    avatarGroup.add(head);

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), darkMat);
    leftEye.position.set(-0.22, 1.66, 0.58);
    avatarGroup.add(leftEye);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.22;
    avatarGroup.add(rightEye);

    const browGeometry = new THREE.BoxGeometry(0.31, 0.045, 0.045);
    const leftBrow = new THREE.Mesh(browGeometry, darkMat);
    leftBrow.position.set(-0.22, 1.84, 0.58);
    avatarGroup.add(leftBrow);
    const rightBrow = leftBrow.clone();
    rightBrow.position.x = 0.22;
    avatarGroup.add(rightBrow);

    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 20, Math.PI), darkMat);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 1.34, 0.61);
    avatarGroup.add(mouth);

    const makeArm = () => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1, 16), skinMat);
      scene.add(arm);
      return arm;
    };
    const leftArm = makeArm();
    const rightArm = makeArm();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const armDirection = new THREE.Vector3();
    const leftShoulder = new THREE.Vector3(-1.02, 0.34, -0.42);
    const rightShoulder = new THREE.Vector3(1.02, 0.34, -0.42);
    const leftWrist = new THREE.Vector3();
    const rightWrist = new THREE.Vector3();
    const restingLeftWrist = new THREE.Vector3(-1.38, -1.18, -0.35);
    const restingRightWrist = new THREE.Vector3(1.38, -1.18, -0.35);
    const updateArm = (arm, start, end) => {
      armDirection.subVectors(end, start);
      const length = Math.max(0.01, armDirection.length());
      arm.position.copy(start).addScaledVector(armDirection, 0.5);
      arm.scale.set(1, length, 1);
      arm.quaternion.setFromUnitVectors(yAxis, armDirection.normalize());
    };

    // Helper: Construct an Anatomical 3D Hand Model (Left or Right)
    const createHandModel = (isLeft) => {
      const handGroup = new THREE.Group();

      // --- A. Sculpted Palm ---
      const palmGroup = new THREE.Group();
      palmGroup.position.set(0, -0.3, 0);

      // Main Palm Slab with Rounded Contours
      const palmMain = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.45, 0.42), skinMat);
      palmGroup.add(palmMain);

      // Thenar Eminence (Fleshy muscle pad at thumb base)
      const thenarPad = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), palmPadMat);
      thenarPad.scale.set(1.1, 1.35, 0.7);
      thenarPad.position.set(isLeft ? 0.48 : -0.48, -0.35, 0.16);
      palmGroup.add(thenarPad);

      // Hypothenar Eminence (Fleshy pinky palm pad)
      const hypothenarPad = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), palmPadMat);
      hypothenarPad.scale.set(0.9, 1.3, 0.65);
      hypothenarPad.position.set(isLeft ? -0.42 : 0.42, -0.38, 0.14);
      palmGroup.add(hypothenarPad);

      // Knuckle Bridge Arch (Base of fingers)
      const knuckleBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.25, 16), knuckleMat);
      knuckleBridge.rotation.z = Math.PI / 2;
      knuckleBridge.position.set(0, 0.65, 0.05);
      palmGroup.add(knuckleBridge);

      handGroup.add(palmGroup);

      // --- B. Anatomical Wrist & Forearm Transition ---
      const wristGroup = new THREE.Group();
      wristGroup.position.set(0, -1.35, 0);

      const wristGeo = new THREE.CylinderGeometry(0.48, 0.58, 0.95, 20);
      const wristMesh = new THREE.Mesh(wristGeo, skinMat);
      wristGroup.add(wristMesh);

      // Wrist joint crease ring
      const wristCrease = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.03, 8, 24), knuckleMat);
      wristCrease.rotation.x = Math.PI / 2;
      wristCrease.position.y = 0.35;
      wristGroup.add(wristCrease);

      handGroup.add(wristGroup);

      // --- C. 5 Multi-Phalanx Articulated Fingers ---
      // Real human fingers have 3 distinct phalanges (Proximal, Intermediate, Distal with nail)
      const fingerConfigs = [
        {
          name: 'thumb',
          isThumb: true,
          baseX: isLeft ? 0.75 : -0.75,
          baseY: -0.25,
          baseZ: 0.15,
          p1Len: 0.52,
          p2Len: 0.45,
          p3Len: 0.38,
          spreadZ: isLeft ? -0.55 : 0.55,
        },
        {
          name: 'index',
          baseX: isLeft ? 0.48 : -0.48,
          baseY: 0.45,
          baseZ: 0,
          p1Len: 0.58,
          p2Len: 0.42,
          p3Len: 0.34,
          spreadZ: isLeft ? -0.06 : 0.06,
        },
        {
          name: 'middle',
          baseX: isLeft ? 0.16 : -0.16,
          baseY: 0.55,
          baseZ: 0,
          p1Len: 0.65,
          p2Len: 0.46,
          p3Len: 0.36,
          spreadZ: 0,
        },
        {
          name: 'ring',
          baseX: isLeft ? -0.18 : 0.18,
          baseY: 0.48,
          baseZ: 0,
          p1Len: 0.58,
          p2Len: 0.42,
          p3Len: 0.34,
          spreadZ: isLeft ? 0.07 : -0.07,
        },
        {
          name: 'pinky',
          baseX: isLeft ? -0.50 : 0.50,
          baseY: 0.36,
          baseZ: 0,
          p1Len: 0.46,
          p2Len: 0.34,
          p3Len: 0.28,
          spreadZ: isLeft ? 0.18 : -0.18,
        },
      ];

      const fingers = {};

      fingerConfigs.forEach((fc) => {
        const baseGroup = new THREE.Group();
        baseGroup.position.set(fc.baseX, fc.baseY, fc.baseZ);
        baseGroup.rotation.z = fc.spreadZ;

        // 1. Base Joint (MCP Knuckle)
        const baseKnuckle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), knuckleMat);
        baseGroup.add(baseKnuckle);

        // 2. Proximal Phalanx (Segment 1)
        const p1Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.155, fc.p1Len, 16), skinMat);
        p1Mesh.position.y = fc.p1Len * 0.5;
        baseGroup.add(p1Mesh);

        // 3. Intermediate Pivot (PIP Joint)
        const pipGroup = new THREE.Group();
        pipGroup.position.set(0, fc.p1Len, 0);

        const pipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), knuckleMat);
        pipGroup.add(pipJoint);

        // Intermediate Phalanx (Segment 2)
        const p2Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, fc.p2Len, 16), skinMat);
        p2Mesh.position.y = fc.p2Len * 0.5;
        pipGroup.add(p2Mesh);

        // 4. Distal Pivot (DIP Joint & Tip)
        const dipGroup = new THREE.Group();
        dipGroup.position.set(0, fc.p2Len, 0);

        const dipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 16), knuckleMat);
        dipGroup.add(dipJoint);

        // Distal Phalanx (Segment 3)
        const p3Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, fc.p3Len, 16), skinMat);
        p3Mesh.position.y = fc.p3Len * 0.5;
        dipGroup.add(p3Mesh);

        // Fingertip Cap
        const tipCap = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), skinMat);
        tipCap.position.y = fc.p3Len;
        dipGroup.add(tipCap);

        // Anatomical Fingernail (Keratin) placed on dorsal (back) side of phalanx
        const nail = new THREE.Mesh(new THREE.BoxGeometry(0.13, fc.p3Len * 0.65, 0.04), nailMat);
        nail.position.set(0, fc.p3Len * 0.65, -0.09);
        dipGroup.add(nail);

        pipGroup.add(dipGroup);
        baseGroup.add(pipGroup);
        handGroup.add(baseGroup);

        fingers[fc.name] = {
          baseGroup,
          pipGroup,
          dipGroup,
          config: fc,
        };
      });

      return { handGroup, fingers, isLeft };
    };

    // Create Left & Right Hands with Matching Real Skin Colors
    const leftHandObj = createHandModel(true);
    leftHandObj.handGroup.position.set(-1.45, -0.2, 0);
    povHandsGroup.add(leftHandObj.handGroup);

    const rightHandObj = createHandModel(false);
    rightHandObj.handGroup.position.set(1.45, -0.2, 0);
    povHandsGroup.add(rightHandObj.handGroup);

    // Recorded signs must preserve the landmark topology from the training
    // data. Rotating the procedural hand's fixed finger roots distorts that
    // topology (crossed fingers and incorrect spacing), so trained signs use a
    // dedicated mesh whose joints and bones are placed at the recorded points.
    const recordedConnections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [5, 6], [6, 7], [7, 8],
      [9, 10], [10, 11], [11, 12],
      [13, 14], [14, 15], [15, 16],
      [17, 18], [18, 19], [19, 20],
    ];
    const palmLandmarks = [0, 5, 9, 13, 17];
    const recordedHandScale = 1.12;

    const createRecordedHandRig = () => {
      const group = new THREE.Group();
      group.visible = false;
      const points = Array.from({ length: 21 }, () => new THREE.Vector3());
      const targetPoints = Array.from({ length: 21 }, () => new THREE.Vector3());
      const joints = points.map((_, index) => {
        const isMcp = [5, 9, 13, 17].includes(index);
        const isTip = [4, 8, 12, 16, 20].includes(index);
        const radius = index === 0 ? 0.135 : isMcp ? 0.125 : isTip ? 0.09 : 0.105;
        const joint = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), index % 4 === 1 ? knuckleMat : skinMat);
        group.add(joint);
        return joint;
      });
      const bones = recordedConnections.map(([from, to]) => {
        const isThumb = to <= 4;
        const segment = (to - 1) % 4;
        const proximalRadius = isThumb ? 0.112 : 0.1;
        const taper = segment === 0 ? 1 : segment === 1 ? 0.9 : 0.8;
        const bone = new THREE.Mesh(
          new THREE.CylinderGeometry(proximalRadius * taper * 0.88, proximalRadius * taper, 1, 14),
          skinMat,
        );
        group.add(bone);
        return { from, to, mesh: bone };
      });

      const palmGeometry = new THREE.BufferGeometry();
      const palmPositions = new Float32Array(10 * 3);
      palmGeometry.setAttribute('position', new THREE.BufferAttribute(palmPositions, 3).setUsage(THREE.DynamicDrawUsage));
      const palmIndices = [
        0, 1, 2, 0, 2, 3, 0, 3, 4,
        5, 7, 6, 5, 8, 7, 5, 9, 8,
        0, 5, 6, 0, 6, 1,
        1, 6, 7, 1, 7, 2,
        2, 7, 8, 2, 8, 3,
        3, 8, 9, 3, 9, 4,
        4, 9, 5, 4, 5, 0,
      ];
      palmGeometry.setIndex(palmIndices);
      const palm = new THREE.Mesh(palmGeometry, skinMat);
      group.add(palm);

      // A rounded palm volume fills the landmark polygon so the recorded rig
      // reads as a hand rather than a collection of rods. Its dimensions and
      // direction are recomputed from the wrist and MCP landmarks.
      const palmVolume = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skinMat);
      group.add(palmVolume);
      const thenarPad = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), palmPadMat);
      group.add(thenarPad);
      const hypothenarPad = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), palmPadMat);
      group.add(hypothenarPad);

      // Fingernails and slightly enlarged fingertip caps provide orientation
      // and make individual digits legible when fingers overlap in depth.
      const tipIndices = [4, 8, 12, 16, 20];
      const nails = tipIndices.map(() => {
        const nail = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.14, 0.025), nailMat);
        group.add(nail);
        return nail;
      });
      const fingertips = tipIndices.map(() => {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 11), skinMat);
        tip.scale.set(1, 1.15, 0.9);
        group.add(tip);
        return tip;
      });

      return {
        group,
        points,
        targetPoints,
        joints,
        bones,
        palmGeometry,
        palmPositions,
        palmVolume,
        thenarPad,
        hypothenarPad,
        tipIndices,
        nails,
        fingertips,
      };
    };

    const recordedLeftHand = createRecordedHandRig();
    const recordedRightHand = createRecordedHandRig();
    povHandsGroup.add(recordedLeftHand.group, recordedRightHand.group);

    const recordedRight = new Float32Array(60);
    const recordedLeft = new Float32Array(60);
    const recordedSample = {
      available: false,
      rightPresent: false,
      leftPresent: false,
      right: recordedRight,
      left: recordedLeft,
      rightWrist: [0, 0, 0],
      leftWrist: [0, 0, 0],
      twoHanded: false,
    };

    const fillInterpolated = (target, first, second, blend) => {
      const from = first || second;
      const to = second || first;
      if (!from || !to) return false;
      for (let index = 0; index < target.length; index += 1) {
        target[index] = from[index] + (to[index] - from[index]) * blend;
      }
      return true;
    };

    const fillWrist = (target, first, second, blend) => {
      const from = first || second;
      const to = second || first;
      if (!from || !to) return false;
      for (let index = 0; index < 3; index += 1) {
        target[index] = from[index] + (to[index] - from[index]) * blend;
      }
      return true;
    };

    const getRecordedSample = (signKey, elapsed) => {
      const library = poseLibraryRef.current;
      const key = normalizeDatasetKey(signKey).replace(/\s+/g, '_');
      const fullKey = `${languageRef.current || 'ASL'}_${key}`;
      recordedSample.available = false;
      recordedSample.rightPresent = false;
      recordedSample.leftPresent = false;
      if (!library || !key || key === 'NONE') return recordedSample;

      const dynamic = library.dynamic?.[fullKey];
      if (dynamic?.frames?.length) {
        const frames = dynamic.frames;
        const motionSeconds = Math.max(0.8, dynamic.durationSeconds || frames.length / (dynamic.fps || 30));
        const progress = getRecordedPlaybackProgress(elapsed, motionSeconds);
        const position = progress * (frames.length - 1);
        const low = Math.floor(position);
        const high = Math.min(frames.length - 1, low + 1);
        const blend = position - low;
        const first = frames[low];
        const second = frames[high];
        recordedSample.rightPresent = fillInterpolated(recordedRight, first.r, second.r, blend);
        recordedSample.leftPresent = fillInterpolated(recordedLeft, first.l, second.l, blend);
        fillWrist(recordedSample.rightWrist, first.rw, second.rw, blend);
        fillWrist(recordedSample.leftWrist, first.lw, second.lw, blend);
        recordedSample.twoHanded = Boolean(dynamic.twoHanded && recordedSample.rightPresent && recordedSample.leftPresent);
        recordedSample.available = recordedSample.rightPresent || recordedSample.leftPresent;
        return recordedSample;
      }

      const staticPose = library.static?.[fullKey];
      if (staticPose?.hand?.length === 60) {
        recordedRight.set(staticPose.hand);
        recordedSample.rightPresent = true;
        const letterMotion = getLetterMotionOffset(fullKey, elapsed);
        recordedSample.rightWrist[0] = letterMotion[0];
        recordedSample.rightWrist[1] = -0.15 + letterMotion[1];
        recordedSample.rightWrist[2] = -0.08 + letterMotion[2];
        recordedSample.twoHanded = false;
        recordedSample.available = true;
      }
      return recordedSample;
    };

    const readRecordedPoint = (points, landmarkIndex, target) => {
      if (landmarkIndex === 0) return target.set(0, 0, 0);
      const offset = (landmarkIndex - 1) * 3;
      // MediaPipe image Y grows downward; Three.js model Y grows upward.
      return target.set(points[offset], -points[offset + 1], -(points[offset + 2] || 0)).multiplyScalar(recordedHandScale);
    };

    const recordedBoneDirection = new THREE.Vector3();
    const recordedBoneMidpoint = new THREE.Vector3();
    const palmDirection = new THREE.Vector3();
    const palmCenter = new THREE.Vector3();
    const knuckleCenter = new THREE.Vector3();
    const padPosition = new THREE.Vector3();
    const updateRecordedHand = (rig, sourcePoints, position, visible, poseKey) => {
      const poseChanged = rig.lastPoseKey !== poseKey;
      rig.group.visible = visible;
      if (!visible || !sourcePoints) return;
      const initialized = Boolean(rig.lastPoseKey);
      if (!initialized) rig.group.position.copy(position);
      else rig.group.position.lerp(position, poseChanged ? 0.2 : 0.34);
      rig.group.rotation.set(0, 0, 0);
      rig.group.scale.set(1, 1, 1);

      for (let index = 0; index < rig.points.length; index += 1) {
        readRecordedPoint(sourcePoints, index, rig.targetPoints[index]);
        if (!initialized) rig.points[index].copy(rig.targetPoints[index]);
        else rig.points[index].lerp(rig.targetPoints[index], poseChanged ? 0.2 : 0.42);
        rig.joints[index].position.copy(rig.points[index]);
      }
      rig.lastPoseKey = poseKey;
      for (const bone of rig.bones) {
        const start = rig.points[bone.from];
        const end = rig.points[bone.to];
        recordedBoneDirection.subVectors(end, start);
        const length = Math.max(0.01, recordedBoneDirection.length());
        recordedBoneMidpoint.copy(start).addScaledVector(recordedBoneDirection, 0.5);
        bone.mesh.position.copy(recordedBoneMidpoint);
        bone.mesh.scale.set(1, length, 1);
        bone.mesh.quaternion.setFromUnitVectors(yAxis, recordedBoneDirection.normalize());
      }

      const thickness = 0.11;
      palmLandmarks.forEach((landmark, palmIndex) => {
        const point = rig.points[landmark];
        const front = palmIndex * 3;
        const back = (palmIndex + 5) * 3;
        rig.palmPositions[front] = point.x;
        rig.palmPositions[front + 1] = point.y;
        rig.palmPositions[front + 2] = point.z + thickness;
        rig.palmPositions[back] = point.x;
        rig.palmPositions[back + 1] = point.y;
        rig.palmPositions[back + 2] = point.z - thickness;
      });
      rig.palmGeometry.attributes.position.needsUpdate = true;
      rig.palmGeometry.computeVertexNormals();

      knuckleCenter.copy(rig.points[5])
        .add(rig.points[9])
        .add(rig.points[13])
        .add(rig.points[17])
        .multiplyScalar(0.25);
      palmDirection.subVectors(knuckleCenter, rig.points[0]);
      const palmLength = Math.max(0.62, palmDirection.length());
      const palmWidth = Math.max(0.42, rig.points[5].distanceTo(rig.points[17]) * 0.54);
      palmCenter.copy(rig.points[0]).lerp(knuckleCenter, 0.48);
      // Recess the solid palm slightly behind the landmark surface. This
      // prevents it from covering folded fingers when the palm faces camera.
      palmCenter.z -= 0.07;
      rig.palmVolume.position.copy(palmCenter);
      rig.palmVolume.scale.set(palmWidth, palmLength * 0.46, 0.125);
      rig.palmVolume.quaternion.setFromUnitVectors(yAxis, palmDirection.normalize());

      padPosition.copy(rig.points[0]).lerp(rig.points[5], 0.5);
      padPosition.z += 0.015;
      rig.thenarPad.position.copy(padPosition);
      rig.thenarPad.scale.set(0.18, palmLength * 0.29, 0.085);
      rig.thenarPad.quaternion.copy(rig.palmVolume.quaternion);
      padPosition.copy(rig.points[0]).lerp(rig.points[17], 0.52);
      padPosition.z += 0.01;
      rig.hypothenarPad.position.copy(padPosition);
      rig.hypothenarPad.scale.set(0.15, palmLength * 0.27, 0.08);
      rig.hypothenarPad.quaternion.copy(rig.palmVolume.quaternion);

      rig.tipIndices.forEach((tipIndex, nailIndex) => {
        const tip = rig.points[tipIndex];
        const previous = rig.points[tipIndex - 1];
        recordedBoneDirection.subVectors(tip, previous);
        const tipLength = Math.max(0.01, recordedBoneDirection.length());
        recordedBoneDirection.normalize();
        rig.fingertips[nailIndex].position.copy(tip).addScaledVector(recordedBoneDirection, -0.045);
        rig.fingertips[nailIndex].quaternion.setFromUnitVectors(yAxis, recordedBoneDirection);
        rig.nails[nailIndex].position.copy(tip)
          .addScaledVector(recordedBoneDirection, -Math.min(0.075, tipLength * 0.3));
        rig.nails[nailIndex].position.z += 0.092;
        rig.nails[nailIndex].quaternion.setFromUnitVectors(yAxis, recordedBoneDirection);
      });
    };

    // Keep the complete signer inside the viewport. Body-relative wrist
    // positions can legitimately place a raised hand above the head, so a
    // fixed camera distance clips signs such as HELLO on wide/short screens.
    const cameraTarget = new THREE.Vector3(0, 0.15, 0);
    const desiredCameraTarget = new THREE.Vector3();
    const fitCameraToSigner = (recordedPose) => {
      let minX = -1.62;
      let maxX = 1.62;
      let minY = -2.15;
      let maxY = 2.38;
      let minZ = -1.35;
      let maxZ = 0.35;

      const includeRecordedHand = (rig, isVisible) => {
        if (!isVisible) return;
        for (const point of rig.points) {
          const x = rig.group.position.x + point.x;
          const y = rig.group.position.y + point.y + povHandsGroup.position.y;
          const z = rig.group.position.z + point.z;
          minX = Math.min(minX, x - 0.2);
          maxX = Math.max(maxX, x + 0.2);
          minY = Math.min(minY, y - 0.2);
          maxY = Math.max(maxY, y + 0.2);
          minZ = Math.min(minZ, z - 0.2);
          maxZ = Math.max(maxZ, z + 0.2);
        }
      };

      if (recordedPose?.available) {
        includeRecordedHand(recordedRightHand, recordedPose.rightPresent);
        includeRecordedHand(recordedLeftHand, recordedPose.leftPresent);
      } else {
        // The procedural fallback has a known, slightly wider envelope.
        minX = Math.min(minX, -2.25);
        maxX = Math.max(maxX, 2.25);
        maxY = Math.max(maxY, 2.65);
      }

      const centerX = (minX + maxX) * 0.5;
      const centerY = (minY + maxY) * 0.5;
      const centerZ = (minZ + maxZ) * 0.5;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * Math.max(camera.aspect, 0.35));
      const fitHeight = ((maxY - minY) * 0.5) / Math.tan(verticalFov * 0.5);
      const fitWidth = ((maxX - minX) * 0.5) / Math.tan(horizontalFov * 0.5);
      const requiredDistance = Math.max(fitHeight, fitWidth) * 1.18 + (maxZ - minZ) * 0.5;
      const cameraZ = centerZ + THREE.MathUtils.clamp(requiredDistance, 5.9, 9.5);

      desiredCameraTarget.set(centerX, centerY, centerZ);
      cameraTarget.lerp(desiredCameraTarget, 0.14);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, centerX, 0.14);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, centerY, 0.14);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, cameraZ, 0.14);
      camera.lookAt(cameraTarget);
    };

    // 5. Kinematic Pose Dictionary for ALL Pre-Trained Signs
    // Defines { curl1, curl2, curl3, splay } for each finger
    const getPoseForSign = (signKey, isLeftHand, elapsed) => {
      const raw = (signKey || '').trim().replace(/^(ASL_|FSL_)/i, '');

      // The renderer is dataset-locked. Do not invent a posture for arbitrary
      // text: the translator handles unsupported text with trained-letter
      // fingerspelling before it reaches this component.
      if (!isDatasetSign(raw)) {
        return {
          curl: {
            thumb: [0.25, 0.2, 0.15, 0],
            index: [0.35, 0.4, 0.3, 0],
            middle: [0.4, 0.45, 0.35, 0],
            ring: [0.45, 0.5, 0.4, 0],
            pinky: [0.5, 0.55, 0.45, 0],
          },
          arm: {
            x: isLeftHand ? -1.6 : 0,
            y: isLeftHand ? -0.7 : 0,
            z: isLeftHand ? -0.3 : 0.45,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
          },
        };
      }

      // Default relaxed neutral hand
      let curl = {
        thumb: [0.25, 0.2, 0.15, 0],
        index: [0.35, 0.4, 0.3, 0],
        middle: [0.4, 0.45, 0.35, 0],
        ring: [0.45, 0.5, 0.4, 0],
        pinky: [0.5, 0.55, 0.45, 0],
      };

      // Default single-hand positioning: dominant right hand centered in view, left hand resting naturally
      let arm = {
        x: isLeftHand ? -1.35 : 0.42,
        y: isLeftHand ? -0.35 : 0.05,
        z: isLeftHand ? 0 : 0.35,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
      };

      // Helper macros for canonical finger shapes
      const open = [0, 0, 0, 0];
      const fist = [1.35, 1.45, 1.2, 0];
      const hook = [1.1, 1.4, 1.2, 0];
      const semi = [0.65, 0.75, 0.6, 0];

      // ==============================================================
      // 1. ALPHABET LETTERS (A to Z, plus FSL Ñ) - 27 CLASSES
      // ==============================================================
      if (['A', 'a', 'letter_a', 'LETTER_A', 'Letter_A', 'letter a', 'LETTER A', 'Letter A'].includes(raw)) {
        // Closed fist, thumb straight up resting flat alongside index finger
        curl = { thumb: [0.05, 0.1, 0.05, isLeftHand ? 0.3 : -0.3], index: fist, middle: fist, ring: fist, pinky: fist };
      } else if (['B', 'b', 'letter_b', 'LETTER_B', 'Letter_B', 'letter b', 'LETTER B', 'Letter B'].includes(raw)) {
        // 4 fingers extended straight upright together, thumb folded flat across palm
        curl = { thumb: [1.25, 1.35, 1.0, isLeftHand ? -0.45 : 0.45], index: open, middle: open, ring: open, pinky: open };
      } else if (['C', 'c', 'letter_c', 'LETTER_C', 'Letter_C', 'letter c', 'LETTER C', 'Letter C'].includes(raw)) {
        // Curved C-shape on all fingers and thumb facing sideways
        curl = { thumb: [0.55, 0.6, 0.5, 0], index: semi, middle: semi, ring: semi, pinky: semi };
        arm.rotY = isLeftHand ? 0.5 : -0.5;
      } else if (['D', 'd', 'letter_d', 'LETTER_D', 'Letter_D', 'letter d', 'LETTER D', 'Letter D'].includes(raw)) {
        // Index straight up, thumb touching middle, ring, pinky tips to form circular loop
        curl = { thumb: [1.0, 1.15, 0.9, 0], index: open, middle: [1.15, 1.35, 1.1, 0], ring: [1.15, 1.35, 1.1, 0], pinky: [1.15, 1.35, 1.1, 0] };
      } else if (['E', 'e', 'letter_e', 'LETTER_E', 'Letter_E', 'letter e', 'LETTER E', 'Letter E'].includes(raw)) {
        // All four fingertips curled tightly inward, resting on top of folded thumb
        curl = { thumb: [1.3, 1.4, 1.1, isLeftHand ? -0.3 : 0.3], index: [1.35, 1.45, 1.25, 0], middle: [1.35, 1.45, 1.25, 0], ring: [1.35, 1.45, 1.25, 0], pinky: [1.35, 1.45, 1.25, 0] };
      } else if (['F', 'f', 'letter_f', 'LETTER_F', 'Letter_F', 'letter f', 'LETTER F', 'Letter F'].includes(raw)) {
        // Index tip touches thumb tip (OK circle); middle, ring, pinky spread upright
        curl = { thumb: [0.85, 0.95, 0.75, 0], index: [0.95, 1.05, 0.85, 0], middle: open, ring: [0, 0, 0, isLeftHand ? -0.15 : 0.15], pinky: [0, 0, 0, isLeftHand ? -0.3 : 0.3] };
      } else if (['G', 'g', 'letter_g', 'LETTER_G', 'Letter_G', 'letter g', 'LETTER G', 'Letter G'].includes(raw)) {
        // Index pointing horizontally forward, thumb parallel alongside it
        curl = { thumb: [0.1, 0.15, 0.1, isLeftHand ? 0.2 : -0.2], index: open, middle: fist, ring: fist, pinky: fist };
        arm.rotZ = isLeftHand ? -1.35 : 1.35;
      } else if (['H', 'h', 'letter_h', 'LETTER_H', 'Letter_H', 'letter h', 'LETTER H', 'Letter H'].includes(raw)) {
        // Index and middle pointing horizontally together, others closed
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: open, ring: fist, pinky: fist };
        arm.rotZ = isLeftHand ? -1.35 : 1.35;
      } else if (['I', 'i', 'letter_i', 'LETTER_I', 'Letter_I', 'letter i', 'LETTER I', 'Letter I'].includes(raw)) {
        // Pinky straight up, other fingers closed with thumb across them
        curl = { thumb: [1.2, 1.3, 0.95, isLeftHand ? -0.25 : 0.25], index: fist, middle: fist, ring: fist, pinky: open };
      } else if (['J', 'j', 'letter_j', 'LETTER_J', 'Letter_J', 'letter j', 'LETTER J', 'Letter J'].includes(raw)) {
        // Pinky up, tracing smooth J hook in 3D air
        const swoop = Math.sin(elapsed * 4);
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: fist, middle: fist, ring: fist, pinky: open };
        arm.x += swoop * 0.22;
        arm.rotZ = (isLeftHand ? -1 : 1) * (swoop * 0.45);
      } else if (['K', 'k', 'letter_k', 'LETTER_K', 'Letter_K', 'letter k', 'LETTER K', 'Letter K'].includes(raw)) {
        // Index straight up, middle finger angled forward 45 deg, thumb between them
        curl = { thumb: [0.35, 0.45, 0.25, 0], index: open, middle: [0.55, 0.35, 0.25, 0], ring: fist, pinky: fist };
      } else if (['L', 'l', 'letter_l', 'LETTER_L', 'Letter_L', 'letter l', 'LETTER L', 'Letter L'].includes(raw)) {
        // Right-angle L: thumb out 90 deg, index straight up, others closed
        curl = { thumb: [0, 0, 0, isLeftHand ? 0.9 : -0.9], index: open, middle: fist, ring: fist, pinky: fist };
      } else if (['M', 'm', 'letter_m', 'LETTER_M', 'Letter_M', 'letter m', 'LETTER M', 'Letter M'].includes(raw)) {
        // 3 fingers (index, middle, ring) folded over thumb
        curl = { thumb: [1.25, 1.35, 0.95, isLeftHand ? -0.5 : 0.5], index: [1.25, 1.35, 1.1, 0], middle: [1.25, 1.35, 1.1, 0], ring: [1.25, 1.35, 1.1, 0], pinky: fist };
      } else if (['N', 'n', 'letter_n', 'LETTER_N', 'Letter_N', 'letter n', 'LETTER N', 'Letter N'].includes(raw)) {
        // 2 fingers (index, middle) folded over thumb
        curl = { thumb: [1.25, 1.35, 0.95, isLeftHand ? -0.4 : 0.4], index: [1.25, 1.35, 1.1, 0], middle: [1.25, 1.35, 1.1, 0], ring: fist, pinky: fist };
      } else if (['Ñ', 'ñ', 'enye', 'ENYE', 'Enye', 'letter_ñ', 'LETTER_Ñ', 'Letter_Ñ', 'letter ñ', 'LETTER Ñ', 'Letter Ñ', 'letter_enye', 'LETTER_ENYE', 'letter enye', 'LETTER ENYE'].includes(raw)) {
        // FSL Ñ: N-handshape with horizontal oscillating wave in 3D air
        const wave = Math.sin(elapsed * 5.5) * 0.22;
        curl = { thumb: [1.25, 1.35, 0.95, isLeftHand ? -0.4 : 0.4], index: [1.25, 1.35, 1.1, 0], middle: [1.25, 1.35, 1.1, 0], ring: fist, pinky: fist };
        arm.x += wave;
        arm.rotY = wave * 0.8;
      } else if (['O', 'o', 'letter_o', 'LETTER_O', 'Letter_O', 'letter o', 'LETTER O', 'Letter O'].includes(raw)) {
        // All fingertips touching thumb to form an O-circle
        curl = { thumb: [0.85, 0.95, 0.8, 0], index: [0.85, 0.95, 0.8, 0], middle: [0.85, 0.95, 0.8, 0], ring: [0.85, 0.95, 0.8, 0], pinky: [0.85, 0.95, 0.8, 0] };
      } else if (['P', 'p', 'letter_p', 'LETTER_P', 'Letter_P', 'letter p', 'LETTER P', 'Letter P'].includes(raw)) {
        // Like K pointing downwards
        curl = { thumb: [0.35, 0.45, 0.25, 0], index: open, middle: [0.55, 0.35, 0.25, 0], ring: fist, pinky: fist };
        arm.rotX = 1.35;
      } else if (['Q', 'q', 'letter_q', 'LETTER_Q', 'Letter_Q', 'letter q', 'LETTER Q', 'Letter Q'].includes(raw)) {
        // Like G pointing downwards
        curl = { thumb: [0.1, 0.15, 0.1, isLeftHand ? 0.2 : -0.2], index: open, middle: fist, ring: fist, pinky: fist };
        arm.rotX = 1.35;
      } else if (['R', 'r', 'letter_r', 'LETTER_R', 'Letter_R', 'letter r', 'LETTER R', 'Letter R'].includes(raw)) {
        // Middle finger crossed over index finger upright
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: [0, 0, 0, isLeftHand ? -0.15 : 0.15], middle: [0, 0, 0, isLeftHand ? 0.22 : -0.22], ring: fist, pinky: fist };
      } else if (['S', 's', 'letter_s', 'LETTER_S', 'Letter_S', 'letter s', 'LETTER S', 'Letter S'].includes(raw)) {
        // Tight fist with thumb folded horizontally across the front of fingers
        curl = { thumb: [1.35, 1.45, 1.15, 0], index: fist, middle: fist, ring: fist, pinky: fist };
      } else if (['T', 't', 'letter_t', 'LETTER_T', 'Letter_T', 'letter t', 'LETTER T', 'Letter T'].includes(raw)) {
        // Thumb between index and middle (index hooked over thumb)
        curl = { thumb: [0.95, 1.15, 0.85, isLeftHand ? -0.25 : 0.25], index: [1.25, 1.35, 1.1, 0], middle: fist, ring: fist, pinky: fist };
      } else if (['U', 'u', 'letter_u', 'LETTER_U', 'Letter_U', 'letter u', 'LETTER U', 'Letter U'].includes(raw)) {
        // Index and middle straight up together (touching)
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: open, ring: fist, pinky: fist };
      } else if (['V', 'v', 'letter_v', 'LETTER_V', 'Letter_V', 'letter v', 'LETTER V', 'Letter V'].includes(raw)) {
        // V-peace sign spread
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: [0, 0, 0, isLeftHand ? 0.2 : -0.2], middle: [0, 0, 0, isLeftHand ? -0.2 : 0.2], ring: fist, pinky: fist };
      } else if (['W', 'w', 'letter_w', 'LETTER_W', 'Letter_W', 'letter w', 'LETTER W', 'Letter W'].includes(raw)) {
        // Index, middle, ring straight up spread in W
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: [0, 0, 0, isLeftHand ? 0.22 : -0.22], middle: open, ring: [0, 0, 0, isLeftHand ? -0.22 : 0.22], pinky: fist };
      } else if (['X', 'x', 'letter_x', 'LETTER_X', 'Letter_X', 'letter x', 'LETTER X', 'Letter X'].includes(raw)) {
        // Index hooked, other fingers in fist
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: hook, middle: fist, ring: fist, pinky: fist };
      } else if (['Y', 'y', 'letter_y', 'LETTER_Y', 'Letter_Y', 'letter y', 'LETTER Y', 'Letter Y'].includes(raw)) {
        // Thumb and pinky extended wide (shaka), middle 3 curled
        curl = { thumb: [0, 0, 0, isLeftHand ? 0.8 : -0.8], index: fist, middle: fist, ring: fist, pinky: [0, 0, 0, isLeftHand ? -0.35 : 0.35] };
      } else if (['Z', 'z', 'letter_z', 'LETTER_Z', 'Letter_Z', 'letter z', 'LETTER Z', 'Letter Z'].includes(raw)) {
        // Index finger traces a Z path in 3D air
        const waveZ = Math.sin(elapsed * 4.5);
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: fist, ring: fist, pinky: fist };
        arm.x += waveZ * 0.28;
        arm.y += Math.cos(elapsed * 4.5) * 0.15;
      }
      // ==============================================================
      // 2. DIGITS & NUMBERS (0 to 9) - 10 CLASSES
      // ==============================================================
      else if (['0', 'zero', 'ZERO', 'Zero', 'number_0', 'NUMBER_0', 'Number_0', 'number 0', 'NUMBER 0', 'Number 0'].includes(raw)) {
        // Oval O circle
        curl = { thumb: [0.85, 0.95, 0.8, 0], index: [0.85, 0.95, 0.8, 0], middle: [0.85, 0.95, 0.8, 0], ring: [0.85, 0.95, 0.8, 0], pinky: [0.85, 0.95, 0.8, 0] };
      } else if (['1', 'one', 'ONE', 'One', 'number_1', 'NUMBER_1', 'Number_1', 'number 1', 'NUMBER 1', 'Number 1'].includes(raw)) {
        // Index finger upright
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: fist, ring: fist, pinky: fist };
      } else if (['2', 'two', 'TWO', 'Two', 'number_2', 'NUMBER_2', 'Number_2', 'number 2', 'NUMBER 2', 'Number 2'].includes(raw)) {
        // Index and middle in V
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: [0, 0, 0, isLeftHand ? 0.18 : -0.18], middle: [0, 0, 0, isLeftHand ? -0.18 : 0.18], ring: fist, pinky: fist };
      } else if (['3', 'three', 'THREE', 'Three', 'number_3', 'NUMBER_3', 'Number_3', 'number 3', 'NUMBER 3', 'Number 3'].includes(raw)) {
        // ASL/FSL 3: Thumb, index, and middle extended; ring and pinky curled
        curl = { thumb: [0, 0, 0, isLeftHand ? 0.65 : -0.65], index: open, middle: open, ring: fist, pinky: fist };
      } else if (['4', 'four', 'FOUR', 'Four', 'number_4', 'NUMBER_4', 'Number_4', 'number 4', 'NUMBER 4', 'Number 4'].includes(raw)) {
        // 4 fingers upright, thumb folded in palm
        curl = { thumb: [1.25, 1.35, 1.0, 0], index: open, middle: open, ring: open, pinky: open };
      } else if (['5', 'five', 'FIVE', 'Five', 'number_5', 'NUMBER_5', 'Number_5', 'number 5', 'NUMBER 5', 'Number 5'].includes(raw)) {
        // All 5 fingers spread wide
        curl = { thumb: [0, 0, 0, isLeftHand ? 0.75 : -0.75], index: [0, 0, 0, isLeftHand ? 0.22 : -0.22], middle: open, ring: [0, 0, 0, isLeftHand ? -0.18 : 0.18], pinky: [0, 0, 0, isLeftHand ? -0.32 : 0.32] };
      } else if (['6', 'six', 'SIX', 'Six', 'number_6', 'NUMBER_6', 'Number_6', 'number 6', 'NUMBER 6', 'Number 6'].includes(raw)) {
        // Thumb touches pinky tip; index, middle, ring straight up
        curl = { thumb: [0.95, 1.15, 0.85, 0], index: open, middle: open, ring: open, pinky: [0.95, 1.15, 0.85, 0] };
      } else if (['7', 'seven', 'SEVEN', 'Seven', 'number_7', 'NUMBER_7', 'Number_7', 'number 7', 'NUMBER 7', 'Number 7'].includes(raw)) {
        // Thumb touches ring tip; index, middle, pinky straight up
        curl = { thumb: [0.95, 1.15, 0.85, 0], index: open, middle: open, ring: [0.95, 1.15, 0.85, 0], pinky: open };
      } else if (['8', 'eight', 'EIGHT', 'Eight', 'number_8', 'NUMBER_8', 'Number_8', 'number 8', 'NUMBER 8', 'Number 8'].includes(raw)) {
        // Thumb touches middle tip; index, ring, pinky straight up
        curl = { thumb: [0.95, 1.15, 0.85, 0], index: open, middle: [0.95, 1.15, 0.85, 0], ring: open, pinky: open };
      } else if (['9', 'nine', 'NINE', 'Nine', 'number_9', 'NUMBER_9', 'Number_9', 'number 9', 'NUMBER 9', 'Number 9'].includes(raw)) {
        // Thumb touches index tip (OK circle); middle, ring, pinky straight up
        curl = { thumb: [0.85, 0.95, 0.75, 0], index: [0.85, 0.95, 0.75, 0], middle: open, ring: open, pinky: open };
      }
      // ==============================================================
      // 3. FSL CONVERSATIONAL PHRASES - 13 CLASSES
      // ==============================================================
      else if ([
        'KUMUSTA', 'kumusta', 'Kumusta',
        'KAMUSTA', 'kamusta', 'Kamusta',
        'KUMUSTA_KA_NA', 'kumusta_ka_na', 'Kumusta_Ka_Na',
        'KAMUSTA_KA_NA', 'kamusta_ka_na', 'Kamusta_Ka_Na',
        'KUMUSTA KA NA', 'kumusta ka na', 'Kumusta Ka Na',
        'KAMUSTA KA NA', 'kamusta ka na', 'Kamusta Ka Na',
        'HELLO', 'hello', 'Hello',
        'HI', 'hi', 'Hi',
        'HEY', 'hey', 'Hey',
        'HOW_ARE_YOU', 'how_are_you', 'How_Are_You',
        'HOW ARE YOU', 'how are you', 'How Are You',
        'GREETINGS', 'greetings', 'Greetings',
      ].includes(raw)) {
        // Open hand warm wave greeting
        const wave = Math.sin(elapsed * 5.5) * 0.25;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = isLeftHand ? -1.35 : 0.45;
        arm.y = 0.35;
        arm.z = 0.45;
        arm.rotX = 0.2;
        arm.rotZ = (isLeftHand ? -1 : 1) * wave;
      } else if ([
        'MAGANDANG_ARAW', 'magandang_araw', 'Magandang_Araw',
        'MAGANDANG ARAW', 'magandang araw', 'Magandang Araw',
        'GOOD_DAY', 'good_day', 'Good_Day',
        'GOOD DAY', 'good day', 'Good Day',
      ].includes(raw)) {
        // Cheerful open sunshine greeting
        const shine = Math.sin(elapsed * 4.5) * 0.12;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = isLeftHand ? -0.55 : 0.55;
        arm.y = 0.35 + shine;
        arm.z = 0.4;
        arm.rotX = 0.25;
      } else if ([
        'MAGANDANG_HAPON', 'magandang_hapon', 'Magandang_Hapon',
        'MAGANDANG HAPON', 'magandang hapon', 'Magandang Hapon',
        'GOOD_AFTERNOON', 'good_afternoon', 'Good_Afternoon',
        'GOOD AFTERNOON', 'good afternoon', 'Good Afternoon',
        'AFTERNOON', 'afternoon', 'Afternoon',
        'HAPON', 'hapon', 'Hapon'
      ].includes(raw)) {
        // Good Afternoon (FSL): Setting sun at 45 degree angle descending over horizon
        const settle = (Math.sin(elapsed * 2.8) + 1) * 0.5;
        if (!isLeftHand) {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = 0.45;
          arm.y = 0.15 - settle * 0.35;
          arm.z = 0.45;
          arm.rotZ = -0.55;
        } else {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = -0.35;
          arm.y = -0.2;
          arm.z = 0.4;
          arm.rotZ = 1.3;
        }
      } else if ([
        'MAGANDANG_UMAGA', 'magandang_umaga', 'Magandang_Umaga',
        'MAGANDANG UMAGA', 'magandang umaga', 'Magandang Umaga',
        'GOOD_MORNING', 'good_morning', 'Good_Morning',
        'GOOD MORNING', 'good morning', 'Good Morning',
        'UMAGA', 'umaga', 'Umaga',
        'MORNING', 'morning', 'Morning'
      ].includes(raw)) {
        // Good Morning (FSL): Rising sun motion over horizontal arm
        const rise = (Math.sin(elapsed * 3) + 1) * 0.5;
        if (!isLeftHand) {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = 0.4;
          arm.y = -0.2 + rise * 0.6;
          arm.z = 0.5;
        } else {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = -0.4;
          arm.y = -0.2;
          arm.z = 0.4;
          arm.rotZ = 1.3;
        }
      } else if ([
        'MAGANDANG_TANGHALI', 'magandang_tanghali', 'Magandang_Tanghali',
        'MAGANDANG TANGHALI', 'magandang tanghali', 'Magandang Tanghali',
        'GOOD_NOON', 'good_noon', 'Good_Noon',
        'GOOD NOON', 'good noon', 'Good Noon',
        'NOON', 'noon', 'Noon',
        'MIDDAY', 'midday', 'Midday',
        'TANGHALI', 'tanghali', 'Tanghali'
      ].includes(raw)) {
        // Good Noon (FSL): Midday overhead sun (arm pointing straight up 12 o'clock above horizontal arm)
        const shine = Math.sin(elapsed * 4) * 0.08;
        if (!isLeftHand) {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = 0.2;
          arm.y = 0.55 + shine;
          arm.z = 0.35;
          arm.rotZ = 0.05;
        } else {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = -0.35;
          arm.y = -0.15;
          arm.z = 0.4;
          arm.rotZ = 1.3;
        }
      } else if ([
        'MAGANDANG_GABI', 'magandang_gabi', 'Magandang_Gabi',
        'MAGANDANG GABI', 'magandang gabi', 'Magandang Gabi',
        'GOOD_EVENING', 'good_evening', 'Good_Evening',
        'GOOD EVENING', 'good evening', 'Good Evening',
        'EVENING', 'evening', 'Evening',
        'NIGHT', 'night', 'Night',
        'GABI', 'gabi', 'Gabi'
      ].includes(raw)) {
        // Good Evening (FSL): Sun dipping down below horizontal base arm
        const sunset = (Math.sin(elapsed * 3) + 1) * 0.5;
        if (!isLeftHand) {
          curl = { thumb: [0.3, 0.4, 0.3, 0], index: semi, middle: semi, ring: semi, pinky: semi };
          arm.x = 0.15 - sunset * 0.35;
          arm.y = -0.15 - sunset * 0.25;
          arm.z = 0.55;
          arm.rotX = 0.6;
        } else {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = -0.3;
          arm.y = -0.1;
          arm.z = 0.45;
          arm.rotZ = 1.3;
        }
      } else if ([
        'SALAMAT', 'salamat', 'Salamat',
        'MARAMING_SALAMAT', 'maraming_salamat', 'Maraming_Salamat',
        'MARAMING SALAMAT', 'maraming salamat', 'Maraming Salamat',
        'THANK_YOU', 'thank_you', 'Thank_You',
        'THANK YOU', 'thank you', 'Thank You',
        'THANKS', 'thanks', 'Thanks',
        'THX', 'thx'
      ].includes(raw)) {
        // Hand touches chin and sweeps forward/downward in gratitude
        const sweep = (Math.sin(elapsed * 3.5) + 1) * 0.5;
        if (isLeftHand) {
          arm.x = -1.45;
          arm.y = -0.45;
          arm.z = 0;
        } else {
          curl = { thumb: [0.1, 0.1, 0, 0], index: open, middle: open, ring: open, pinky: open };
          arm.x = 0.25 - sweep * 0.2;
          arm.y = 0.25 - sweep * 0.35;
          arm.z = 0.2 + sweep * 0.75;
          arm.rotX = 0.45 - sweep * 0.25;
        }
      } else if ([
        'AKO', 'ako', 'Ako',
        'I', 'i',
        'ME', 'me', 'Me',
        'MYSELF', 'myself', 'Myself',
        'I_OR_ME', 'i_or_me', 'I_Or_Me',
        'I OR ME', 'i or me', 'I Or Me'
      ].includes(raw)) {
        // Pointing index finger to own chest
        if (isLeftHand) {
          arm.x = -1.45;
          arm.y = -0.45;
          arm.z = 0;
        } else {
          curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: fist, ring: fist, pinky: fist };
          arm.x = 0.15;
          arm.y = 0.1;
          arm.z = 0.6;
          arm.rotX = -0.6;
        }
      } else if ([
        'AKO_AY_MABUTI', 'ako_ay_mabuti', 'Ako_Ay_Mabuti',
        'AKO AY MABUTI', 'ako ay mabuti', 'Ako Ay Mabuti',
        'MABUTI', 'mabuti', 'Mabuti',
        'I_AM_GOOD', 'i_am_good', 'I_Am_Good',
        'I AM GOOD', 'i am good', 'I Am Good',
        'I_AM_FINE', 'i_am_fine', 'I_Am_Fine',
        'I AM FINE', 'i am fine', 'I Am Fine',
      ].includes(raw)) {
        // Point to chest then open into gentle affirmative palm
        const pulse = (Math.sin(elapsed * 4) + 1) * 0.5;
        if (isLeftHand) {
          arm.x = -1.45;
          arm.y = -0.45;
          arm.z = 0;
        } else {
          curl = { thumb: [0.1, 0.1, 0, -0.3], index: open, middle: open, ring: open, pinky: open };
          arm.x = 0.2;
          arm.y = 0.15 + pulse * 0.1;
          arm.z = 0.55;
          arm.rotX = 0.2;
        }
      } else if ([
        'AYOS_LANG', 'ayos_lang', 'Ayos_Lang',
        'AYOS LANG', 'ayos lang', 'Ayos Lang',
        'OK_LANG', 'ok_lang', 'Ok_Lang',
        'OK LANG', 'ok lang', 'Ok Lang',
        'OKAY_LANG', 'okay_lang', 'Okay_Lang',
        'OKAY LANG', 'okay lang', 'Okay Lang',
        'ALL_GOOD', 'all_good', 'All_Good',
        'ALL GOOD', 'all good', 'All Good',
        'FINE', 'fine', 'Fine',
        'OK', 'ok', 'OKAY', 'okay', 'Okay',
        'ALRIGHT', 'alright', 'Alright'
      ].includes(raw)) {
        // 5-hand thumb tapping chest lightly
        const tapChest = Math.sin(elapsed * 6) * 0.1;
        if (isLeftHand) {
          arm.x = -1.45;
          arm.y = -0.45;
          arm.z = 0;
        } else {
          curl = { thumb: [0, 0, 0, -0.7], index: open, middle: open, ring: open, pinky: open };
          arm.x = 0.15;
          arm.z = 0.55 + tapChest;
        }
      } else if ([
        'ANG_PANGALAN_KO_AY', 'ang_pangalan_ko_ay', 'Ang_Pangalan_Ko_Ay',
        'ANG PANGALAN KO AY', 'ang pangalan ko ay', 'Ang Pangalan Ko Ay',
        'PANGALAN_KO', 'pangalan_ko', 'Pangalan_Ko',
        'PANGALAN KO', 'pangalan ko', 'Pangalan Ko',
        'MY_NAME_IS', 'my_name_is', 'My_Name_Is',
        'MY NAME IS', 'my name is', 'My Name Is',
        'NAME_IS', 'name_is', 'NAME IS', 'name is'
      ].includes(raw)) {
        // H-handshape tapping twice (Name sign)
        const tap = Math.sin(elapsed * 6) * 0.12;
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: open, ring: fist, pinky: fist };
        arm.x = (isLeftHand ? -0.25 : 0.25);
        arm.y = 0.2 + tap;
        arm.z = 0.5;
      } else if ([
        'ANO_ANG_PANGALAN_MO', 'ano_ang_pangalan_mo', 'Ano_Ang_Pangalan_Mo',
        'ANO ANG PANGALAN MO', 'ano ang pangalan mo', 'Ano Ang Pangalan Mo',
        'PANGALAN_MO', 'pangalan_mo', 'Pangalan_Mo',
        'PANGALAN MO', 'pangalan mo', 'Pangalan Mo',
        'WHAT_IS_YOUR_NAME', 'what_is_your_name', 'What_Is_Your_Name',
        'WHAT IS YOUR NAME', 'what is your name', 'What Is Your Name'
      ].includes(raw)) {
        // Questioning palms facing up oscillating side to side
        const shrug = Math.sin(elapsed * 5) * 0.15;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = (isLeftHand ? -0.55 : 0.55) + shrug;
        arm.y = 0.15;
        arm.z = 0.5;
        arm.rotX = 0.7;
      } else if ([
        'MAY_SAKIT_AKO', 'may_sakit_ako', 'May_Sakit_Ako',
        'MAY SAKIT AKO', 'may sakit ako', 'May Sakit Ako',
        'MAY_SAKIT', 'may_sakit', 'May_Sakit',
        'MAY SAKIT', 'may sakit', 'May Sakit',
        'SAKIT', 'sakit', 'Sakit',
        'I_AM_SICK', 'i_am_sick', 'I_Am_Sick',
        'I AM SICK', 'i am sick', 'I Am Sick',
        'SICK', 'sick', 'Sick',
        'ILL', 'ill', 'Ill'
      ].includes(raw)) {
        // Middle fingers bent inward pointing to forehead & stomach (sick)
        const pulse = Math.sin(elapsed * 5) * 0.1;
        curl = { thumb: open, index: open, middle: [1.2, 1.3, 1.0, 0], ring: open, pinky: open };
        arm.x = isLeftHand ? -0.3 : 0.3;
        arm.y = 0.35 + pulse;
        arm.z = 0.45;
        arm.rotX = -0.3;
      }
      // ==============================================================
      // 4. ASL CONVERSATIONAL PHRASES - 21 CLASSES
      // ==============================================================
      else if (['GOOD', 'good', 'Good'].includes(raw)) {
        // ASL GOOD: flat dominant hand starts at the chin and moves down.
        const drop = (Math.sin(elapsed * 3.2) + 1) * 0.5;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = isLeftHand ? -1.6 : 0.05;
        arm.y = isLeftHand ? -0.7 : 0.42 - drop * 0.28;
        arm.z = isLeftHand ? -0.3 : 0.52 + drop * 0.16;
        arm.rotX = -0.25;
      } else if (["WHAT'S_UP", "what's_up", "What's_Up", "WHAT'S UP", "what's up", "What's Up"].includes(raw)) {
        // ASL WHAT'S UP: two relaxed open hands presented palms-up.
        const lift = Math.sin(elapsed * 4) * 0.08;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = isLeftHand ? -0.52 : 0.52;
        arm.y = 0.1 + lift;
        arm.z = 0.55;
        arm.rotX = 0.72;
        arm.rotZ = isLeftHand ? 0.24 : -0.24;
      } else if ([
        'I_LOVE_YOU', 'i_love_you', 'I_Love_You',
        'I LOVE YOU', 'i love you', 'I Love You',
        'LOVE', 'love', 'Love',
        'ILY', 'ily', 'Ily',
        'LOVE_YOU', 'love_you', 'Love_You',
        'LOVE YOU', 'love you', 'Love You',
        'MAHAL_KITA', 'mahal_kita', 'Mahal_Kita',
        'MAHAL KITA', 'mahal kita', 'Mahal Kita'
      ].includes(raw)) {
        // Canonical ILY (I Love You) Sign:
        // Single dominant right hand centered in viewport, palm facing viewer.
        // Thumb extended wide 90° outward to the side (L-shape).
        // Index finger extended straight UP.
        // Middle & Ring fingers curled tight flat into palm.
        // Pinky finger extended straight UP with slight outward flair.
        // Left hand rests idle at the side.
        const rock = Math.sin(elapsed * 3.5) * 0.12;
        if (isLeftHand) {
          curl = {
            thumb: [0.35, 0.3, 0.2, 0],
            index: [0.45, 0.5, 0.4, 0],
            middle: [0.5, 0.55, 0.45, 0],
            ring: [0.55, 0.6, 0.5, 0],
            pinky: [0.6, 0.65, 0.55, 0],
          };
          arm.x = -1.45;
          arm.y = -0.45;
          arm.z = 0;
          arm.rotX = 0;
          arm.rotY = 0;
          arm.rotZ = 0;
        } else {
          curl = {
            thumb: [0, 0, 0, -0.92],        // Extended wide sideways to form the 'L'
            index: open,                    // Straight UP
            middle: [1.4, 1.45, 1.25, 0],   // Tightly curled into palm
            ring: [1.4, 1.45, 1.25, 0],     // Tightly curled into palm
            pinky: [0, 0, 0, 0.28],         // Straight UP with natural outward flair
          };
          arm.x = 0.05; // Prominently centered in viewport
          arm.y = 0.14;
          arm.z = 0.42;
          arm.rotX = rock;
          arm.rotY = 0;
          arm.rotZ = 0;
        }
      } else if ([
        'PLEASE', 'please', 'Please',
        'PLS', 'pls', 'Pls',
        'PAKIUSAP', 'pakiusap', 'Pakiusap',
        'PATAWAD', 'patawad', 'Patawad'
      ].includes(raw)) {
        // Right hand open flat palm rubbed in circular motion on chest
        const angle = elapsed * 3.5;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = isLeftHand ? -1.35 : 0.35 + Math.cos(angle) * 0.12;
        arm.y = isLeftHand ? -0.35 : 0.15 + Math.sin(angle) * 0.12;
        arm.z = isLeftHand ? 0 : 0.45;
        arm.rotX = -0.3;
      } else if ([
        'HELP', 'help', 'Help',
        'ASSIST', 'assist', 'Assist',
        'ASSISTANCE', 'assistance', 'Assistance',
        'TULONG', 'tulong', 'Tulong',
        'SAKLOLO', 'saklolo', 'Saklolo'
      ].includes(raw)) {
        // Left hand flat palm up at waist; Right hand in thumbs-up fist on left palm, both lifting upward together
        const lift = (Math.sin(elapsed * 3) + 1) * 0.5 * 0.25;
        if (isLeftHand) {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = -0.35;
          arm.y = -0.1 + lift;
          arm.z = 0.45;
          arm.rotX = 0.5;
        } else {
          curl = { thumb: [0.05, 0.1, 0.05, 0], index: fist, middle: fist, ring: fist, pinky: fist };
          arm.x = 0.15;
          arm.y = 0.12 + lift;
          arm.z = 0.45;
        }
      } else if ([
        'MORE', 'more', 'More',
        'DAGDAG', 'dagdag', 'Dagdag',
        'PA', 'pa', 'Pa'
      ].includes(raw)) {
        // Both hands in flat-O pinched shapes tapping together at fingertips repeatedly at midline
        const tapMore = Math.abs(Math.sin(elapsed * 5)) * 0.18;
        curl = { thumb: [0.85, 0.95, 0.8, 0], index: [0.85, 0.95, 0.8, 0], middle: [0.85, 0.95, 0.8, 0], ring: [0.85, 0.95, 0.8, 0], pinky: [0.85, 0.95, 0.8, 0] };
        arm.x = (isLeftHand ? -0.42 : 0.42) * (1 - tapMore);
        arm.y = 0.1;
        arm.z = 0.45;
        arm.rotY = isLeftHand ? 0.7 : -0.7;
      } else if ([
        'YES', 'yes', 'Yes',
        'YEAH', 'yeah', 'Yeah',
        'YEP', 'yep', 'Yep',
        'CORRECT', 'correct', 'Correct',
        'OO', 'oo', 'Oo', 'OPO', 'opo', 'Opo'
      ].includes(raw)) {
        // S-fist nodding up and down at the wrist like nodding yes
        const nod = Math.sin(elapsed * 5) * 0.38;
        curl = { thumb: [1.35, 1.4, 1.1, 0], index: fist, middle: fist, ring: fist, pinky: fist };
        arm.x = isLeftHand ? -1.35 : 0.38;
        arm.y = 0.15;
        arm.z = 0.4;
        arm.rotX = nod;
      } else if ([
        'NO', 'no', 'No',
        'NOPE', 'nope', 'Nope',
        'NAH', 'nah', 'Nah',
        'INCORRECT', 'incorrect', 'Incorrect',
        'HINDI', 'hindi', 'Hindi'
      ].includes(raw)) {
        // Index and middle fingers snapping shut against thumb repeatedly
        const snap = (Math.sin(elapsed * 6) + 1) * 0.5;
        const curVal = 0.25 + snap * 0.95;
        curl = { thumb: [curVal, curVal, curVal * 0.8, 0], index: [curVal, curVal, curVal * 0.8, 0], middle: [curVal, curVal, curVal * 0.8, 0], ring: fist, pinky: fist };
        arm.x = isLeftHand ? -1.35 : 0.38;
        arm.y = 0.15;
        arm.z = 0.4;
      } else if ([
        'EAT', 'eat', 'Eat',
        'FOOD', 'food', 'Food',
        'EATING', 'eating', 'Eating',
        'HUNGRY', 'hungry', 'Hungry',
        'KAIN', 'kain', 'Kain',
        'PAGKAIN', 'pagkain', 'Pagkain'
      ].includes(raw)) {
        // Flat-O pinched hand moving repeatedly to touch mouth/lips
        const munch = (Math.sin(elapsed * 4) + 1) * 0.5;
        curl = { thumb: [0.85, 0.95, 0.8, 0], index: [0.85, 0.95, 0.8, 0], middle: [0.85, 0.95, 0.8, 0], ring: [0.85, 0.95, 0.8, 0], pinky: [0.85, 0.95, 0.8, 0] };
        arm.x = isLeftHand ? -1.35 : 0.35 - munch * 0.2;
        arm.y = isLeftHand ? -0.35 : 0.15 + munch * 0.3;
        arm.z = isLeftHand ? 0 : 0.4 + munch * 0.25;
        arm.rotX = -0.4 * munch;
      } else if ([
        'WANT', 'want', 'Want',
        'NEED', 'need', 'Need',
        'DESIRE', 'desire', 'Desire',
        'GUSTO', 'gusto', 'Gusto'
      ].includes(raw)) {
        // Both hands palms up with fingers curved like claws pulling backward toward body
        const pull = (Math.sin(elapsed * 3) + 1) * 0.5;
        curl = { thumb: semi, index: semi, middle: semi, ring: semi, pinky: semi };
        arm.x = isLeftHand ? -0.45 : 0.45;
        arm.y = 0.1 - pull * 0.1;
        arm.z = 0.6 - pull * 0.3;
        arm.rotX = 0.7;
      } else if ([
        'LIKE', 'like', 'Like',
        'FOND', 'fond', 'Fond'
      ].includes(raw)) {
        // Thumb and middle finger on chest, pulling forward while pinching together
        const pinchProgress = (Math.sin(elapsed * 3.5) + 1) * 0.5;
        curl = { thumb: [pinchProgress, pinchProgress, pinchProgress, 0], index: fist, middle: [pinchProgress, pinchProgress, pinchProgress, 0], ring: fist, pinky: fist };
        arm.x = isLeftHand ? -1.35 : 0.25;
        arm.y = 0.15;
        arm.z = 0.5 + pinchProgress * 0.3;
        arm.rotX = -0.3;
      } else if ([
        'FATHER', 'father', 'Father',
        'DAD', 'dad', 'Dad',
        'DADDY', 'daddy', 'Daddy',
        'PAPA', 'papa', 'Papa',
        'TATAY', 'tatay', 'Tatay',
        'ITAY', 'itay', 'Itay'
      ].includes(raw)) {
        // Open 5-hand with thumb tip touching forehead twice
        const tapHead = Math.abs(Math.sin(elapsed * 5)) * 0.15;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = isLeftHand ? -1.35 : 0.2;
        arm.y = 0.65;
        arm.z = 0.45 + tapHead;
        arm.rotX = -0.3;
      } else if ([
        'MOTHER', 'mother', 'Mother',
        'MOM', 'mom', 'Mom',
        'MOMMY', 'mommy', 'Mommy',
        'MAMA', 'mama', 'Mama',
        'NANAY', 'nanay', 'Nanay',
        'INAY', 'inay', 'Inay'
      ].includes(raw)) {
        // Open 5-hand with thumb tip touching chin twice
        const tapChin = Math.abs(Math.sin(elapsed * 5)) * 0.15;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = isLeftHand ? -1.35 : 0.2;
        arm.y = 0.3;
        arm.z = 0.5 + tapChin;
        arm.rotX = -0.2;
      } else if ([
        'DEAF', 'deaf', 'Deaf',
        'BINGI', 'bingi', 'Bingi'
      ].includes(raw)) {
        // Index finger pointing, touching near ear then moving in arc to touch near chin
        const deafCycle = (Math.sin(elapsed * 3) + 1) * 0.5;
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: fist, ring: fist, pinky: fist };
        arm.x = isLeftHand ? -1.35 : 0.35;
        arm.y = 0.55 - deafCycle * 0.25;
        arm.z = 0.4 + deafCycle * 0.15;
        arm.rotX = -0.3;
      } else if ([
        'HARD_OF_HEARING', 'hard_of_hearing', 'Hard_Of_Hearing',
        'HARD OF HEARING', 'hard of hearing', 'Hard Of Hearing',
        'HOH', 'hoh', 'Hoh'
      ].includes(raw)) {
        // H-handshape making a small arc hop sideways in front of body
        const hop = (Math.sin(elapsed * 4) + 1) * 0.5;
        const sway = Math.sin(elapsed * 2) * 0.25;
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: open, ring: fist, pinky: fist };
        arm.x = isLeftHand ? -1.35 : 0.35 + sway;
        arm.y = 0.2 + hop * 0.15;
        arm.z = 0.45;
        arm.rotZ = 1.35;
      } else if ([
        'HEARING', 'hearing', 'Hearing',
        'NAKAKARINIG', 'nakakarinig'
      ].includes(raw)) {
        // Index finger rotating in small forward circles in front of mouth
        const hAngle = elapsed * 5;
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: fist, ring: fist, pinky: fist };
        arm.x = isLeftHand ? -1.35 : 0.2 + Math.cos(hAngle) * 0.12;
        arm.y = 0.35;
        arm.z = 0.45 + Math.sin(hAngle) * 0.12;
        arm.rotZ = 1.35;
      } else if ([
        'LEARN', 'learn', 'Learn',
        'STUDY', 'study', 'Study',
        'MATUTO', 'matuto',
        'MAG-ARAL', 'mag-aral'
      ].includes(raw)) {
        // Left hand flat palm up; Right hand touches left palm, then draws up to forehead
        const absorb = (Math.sin(elapsed * 3) + 1) * 0.5;
        if (isLeftHand) {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = -0.35;
          arm.y = -0.1;
          arm.z = 0.45;
          arm.rotX = 0.5;
        } else {
          curl = { thumb: [absorb * 0.8, absorb * 0.9, absorb * 0.7, 0], index: [absorb * 0.8, absorb * 0.9, absorb * 0.7, 0], middle: [absorb * 0.8, absorb * 0.9, absorb * 0.7, 0], ring: [absorb * 0.8, absorb * 0.9, absorb * 0.7, 0], pinky: [absorb * 0.8, absorb * 0.9, absorb * 0.7, 0] };
          arm.x = 0.25 - (1 - absorb) * 0.35;
          arm.y = -0.05 + absorb * 0.65;
          arm.z = 0.45;
        }
      } else if ([
        'PEOPLE', 'people', 'People',
        'PERSON', 'person', 'Person',
        'MGA_TAO', 'mga_tao', 'MGA TAO', 'mga tao',
        'TAO', 'tao', 'Tao'
      ].includes(raw)) {
        // Both hands in P-handshapes rotating in alternating forward vertical circles
        const pAngle = elapsed * 3.5 + (isLeftHand ? Math.PI : 0);
        curl = { thumb: [0.35, 0.45, 0.25, 0], index: open, middle: [0.55, 0.35, 0.25, 0], ring: fist, pinky: fist };
        arm.x = isLeftHand ? -0.4 : 0.4;
        arm.y = 0.15 + Math.sin(pAngle) * 0.15;
        arm.z = 0.45 + Math.cos(pAngle) * 0.15;
        arm.rotX = 1.35;
      } else if ([
        'SEE_YOU_LATER', 'see_you_later', 'See_You_Later',
        'SEE YOU LATER', 'see you later', 'See You Later',
        'LATER', 'later', 'Later',
        'BYE', 'bye', 'Bye',
        'GOODBYE', 'goodbye', 'Goodbye'
      ].includes(raw)) {
        // V-handshape pointing from eye outward toward viewer, then dropping into L-handshape
        const seePhase = (Math.sin(elapsed * 3) + 1) * 0.5;
        curl = seePhase < 0.5 ? { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: open, ring: fist, pinky: fist } : { thumb: [0, 0, 0, -0.85], index: open, middle: fist, ring: fist, pinky: fist };
        arm.x = isLeftHand ? -1.35 : 0.35;
        arm.y = 0.45 - seePhase * 0.3;
        arm.z = 0.4 + seePhase * 0.35;
      } else if ([
        'AGAIN_OR_REPEAT', 'again_or_repeat', 'Again_Or_Repeat',
        'AGAIN OR REPEAT', 'again or repeat', 'Again Or Repeat',
        'AGAIN', 'again', 'Again',
        'REPEAT', 'repeat', 'Repeat',
        'ULIT', 'ulit', 'Ulit'
      ].includes(raw)) {
        // Left flat palm up; Right hand curved open palm flips over and lands in center of left palm
        const flip = (Math.sin(elapsed * 3.5) + 1) * 0.5;
        if (isLeftHand) {
          curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
          arm.x = -0.35;
          arm.y = -0.15;
          arm.z = 0.45;
          arm.rotX = 0.5;
        } else {
          curl = { thumb: [0.3, 0.4, 0.3, 0], index: semi, middle: semi, ring: semi, pinky: semi };
          arm.x = 0.3 - flip * 0.45;
          arm.y = 0.2 - flip * 0.25;
          arm.z = 0.45;
          arm.rotZ = -flip * 2.2;
        }
      } else if ([
        'GO_TO', 'go_to', 'Go_To',
        'GO TO', 'go to', 'Go To',
        'GO', 'go', 'Go',
        'PUNTA', 'punta', 'Punta'
      ].includes(raw)) {
        // Both index fingers pointing and arching forward in unison toward destination
        const goArc = (Math.sin(elapsed * 3.5) + 1) * 0.5;
        curl = { thumb: [1.15, 1.25, 0.95, 0], index: open, middle: fist, ring: fist, pinky: fist };
        arm.x = isLeftHand ? -0.35 : 0.35;
        arm.y = 0.15 + Math.sin(goArc * Math.PI) * 0.2;
        arm.z = 0.3 + goArc * 0.4;
        arm.rotX = 0.35;
      } else if ([
        'WHAT', 'what', 'What',
        'ANO', 'ano', 'Ano'
      ].includes(raw)) {
        // Both hands open with palms facing upward, shaking gently side to side in question gesture
        const whatShrug = Math.sin(elapsed * 5) * 0.12;
        curl = { thumb: open, index: open, middle: open, ring: open, pinky: open };
        arm.x = (isLeftHand ? -0.55 : 0.55) + whatShrug;
        arm.y = 0.12;
        arm.z = 0.45;
        arm.rotX = 0.7;
        arm.rotZ = isLeftHand ? 0.3 : -0.3;
      }

      const datasetKey = normalizeDatasetKey(raw);
      const isTwoHandSign = TWO_HAND_DATASET_SIGNS.has(datasetKey);

      // One-hand signs use the dominant hand as the focal point. The support
      // hand stays lower, slightly farther back, and relaxed instead of
      // competing with the sign in a misleading side-by-side pose.
      if (!isTwoHandSign && isLeftHand) {
        curl = {
          thumb: [0.25, 0.2, 0.15, 0],
          index: [0.35, 0.4, 0.3, 0],
          middle: [0.4, 0.45, 0.35, 0],
          ring: [0.45, 0.5, 0.4, 0],
          pinky: [0.5, 0.55, 0.45, 0],
        };
        arm.x = -1.6;
        arm.y = -0.7;
        arm.z = -0.3;
        arm.rotX = 0.12;
        arm.rotY = 0.18;
        arm.rotZ = 0.1;
      }

      // Center the active hand for one-hand signs. This leaves a clear visual
      // hierarchy in speech/text-to-sign mode without changing the trained
      // finger posture or motion.
      if (!isTwoHandSign && !isLeftHand) {
        arm.x *= 0.38;
      }

      return { curl, arm, isTwoHandSign };
    };

    // 6. Animation Loop with Organic Breathing & Quaternion/Lerp Kinematics
    let animFrameId;
    const clock = new THREE.Clock();
    let playbackElapsed = 0;
    let playbackKey = '';
    let previousClockTime = 0;
    let isInViewport = true;
    let lastRenderedAt = 0;
    const minimumFrameMs = runtimeProfile.lowPower ? 34 : runtimeProfile.compact ? 24 : 16;
    const visibilityObserver = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
        isInViewport = Boolean(entry?.isIntersecting);
      }, { rootMargin: '120px' });
    visibilityObserver?.observe(container);

    const animatePOV = (frameTime = 0) => {
      animFrameId = requestAnimationFrame(animatePOV);
      if (document.hidden || !isInViewport || frameTime - lastRenderedAt < minimumFrameMs) return;
      lastRenderedAt = frameTime;
      const speedMult = playbackSpeedRef.current || 1.0;
      const clockTime = clock.getElapsedTime();
      const frameDelta = Math.min(0.1, Math.max(0, clockTime - previousClockTime));
      previousClockTime = clockTime;
      const activeWord = currentWordRef.current;
      const nextPlaybackKey = `${languageRef.current}_${activeWord}_${animationTokenRef.current}`;
      if (nextPlaybackKey !== playbackKey) {
        playbackKey = nextPlaybackKey;
        playbackElapsed = 0;
      } else {
        playbackElapsed += frameDelta * speedMult;
      }
      const elapsed = playbackElapsed;
      const waitingForRecordedPose = poseLibraryStatusRef.current === 'loading' && isDatasetSign(activeWord);
      povHandsGroup.visible = !waitingForRecordedPose;

      // Subtle organic breathing float
      povHandsGroup.position.y = Math.sin(clockTime * 1.8) * 0.035;

      const leftPose = getPoseForSign(activeWord, true, elapsed);
      const rightPose = getPoseForSign(activeWord, false, elapsed);
      const recordedPose = getRecordedSample(activeWord, elapsed);

      const placeFromRecording = (target, wrist) => {
        target.set(
          // Preserve the dataset's full shoulder-relative reach. Camera fitting
          // keeps wide and overhead signs visible without flattening them.
          THREE.MathUtils.clamp(wrist[0] * 2.0, -2.2, 2.2),
          THREE.MathUtils.clamp(0.34 - wrist[1] * 1.25, -1.35, 1.75),
          // Body-relative depth values describe proximity to the chest, but
          // applying them directly can put fingers inside/behind the torso.
          // Keep the complete hand on the readable front layer while
          // retaining a smaller amount of the recorded depth motion.
          THREE.MathUtils.clamp(0.65 - wrist[2] * 0.25, 0.38, 0.82),
        );
      };
      if (recordedPose.available) {
        if (recordedPose.rightPresent) placeFromRecording(rightWrist, recordedPose.rightWrist);
        if (recordedPose.leftPresent) placeFromRecording(leftWrist, recordedPose.leftWrist);
        const poseKey = `${languageRef.current}_${activeWord}_${animationTokenRef.current}`;
        updateRecordedHand(recordedRightHand, recordedPose.right, rightWrist, recordedPose.rightPresent, poseKey);
        updateRecordedHand(recordedLeftHand, recordedPose.left, leftWrist, recordedPose.leftPresent, poseKey);
      } else {
        recordedRightHand.group.visible = false;
        recordedLeftHand.group.visible = false;
      }

      const isTwoHandSign = recordedPose.available
        ? recordedPose.twoHanded
        : leftPose.isTwoHandSign || rightPose.isTwoHandSign;
      const leftScale = isTwoHandSign ? 1 : 0.01;
      leftHandObj.handGroup.scale.x = THREE.MathUtils.lerp(leftHandObj.handGroup.scale.x, leftScale, 0.12);
      leftHandObj.handGroup.scale.y = THREE.MathUtils.lerp(leftHandObj.handGroup.scale.y, leftScale, 0.12);
      leftHandObj.handGroup.scale.z = THREE.MathUtils.lerp(leftHandObj.handGroup.scale.z, leftScale, 0.12);
      leftHandObj.handGroup.visible = !recordedPose.available && (isTwoHandSign || leftHandObj.handGroup.scale.x > 0.04);
      rightHandObj.handGroup.visible = !recordedPose.available;

      // Smooth Lerp Arm Positions & Rotations (Right Hand)
      rightHandObj.handGroup.position.x = THREE.MathUtils.lerp(rightHandObj.handGroup.position.x, rightPose.arm.x, 0.12);
      rightHandObj.handGroup.position.y = THREE.MathUtils.lerp(rightHandObj.handGroup.position.y, rightPose.arm.y, 0.12);
      rightHandObj.handGroup.position.z = THREE.MathUtils.lerp(rightHandObj.handGroup.position.z, rightPose.arm.z, 0.12);
      rightHandObj.handGroup.rotation.x = THREE.MathUtils.lerp(rightHandObj.handGroup.rotation.x, rightPose.arm.rotX, 0.12);
      rightHandObj.handGroup.rotation.y = THREE.MathUtils.lerp(rightHandObj.handGroup.rotation.y, rightPose.arm.rotY, 0.12);
      rightHandObj.handGroup.rotation.z = THREE.MathUtils.lerp(rightHandObj.handGroup.rotation.z, rightPose.arm.rotZ, 0.12);

      // Smooth Lerp Arm Positions & Rotations (Left Hand)
      leftHandObj.handGroup.position.x = THREE.MathUtils.lerp(leftHandObj.handGroup.position.x, leftPose.arm.x, 0.12);
      leftHandObj.handGroup.position.y = THREE.MathUtils.lerp(leftHandObj.handGroup.position.y, leftPose.arm.y, 0.12);
      leftHandObj.handGroup.position.z = THREE.MathUtils.lerp(leftHandObj.handGroup.position.z, leftPose.arm.z, 0.12);
      leftHandObj.handGroup.rotation.x = THREE.MathUtils.lerp(leftHandObj.handGroup.rotation.x, leftPose.arm.rotX, 0.12);
      leftHandObj.handGroup.rotation.y = THREE.MathUtils.lerp(leftHandObj.handGroup.rotation.y, leftPose.arm.rotY, 0.12);
      leftHandObj.handGroup.rotation.z = THREE.MathUtils.lerp(leftHandObj.handGroup.rotation.z, leftPose.arm.rotZ, 0.12);

      if (!recordedPose.available) {
        leftWrist.set(
          leftHandObj.handGroup.position.x,
          leftHandObj.handGroup.position.y - 1.48 * Math.max(leftHandObj.handGroup.scale.y, 0.72),
          leftHandObj.handGroup.position.z - 0.08,
        );
        rightWrist.set(
          rightHandObj.handGroup.position.x,
          rightHandObj.handGroup.position.y - 1.48,
          rightHandObj.handGroup.position.z - 0.08,
        );
      }
      updateArm(leftArm, leftShoulder, recordedPose.available
        ? (recordedPose.leftPresent ? leftWrist : restingLeftWrist)
        : (isTwoHandSign ? leftWrist : restingLeftWrist));
      updateArm(rightArm, rightShoulder, recordedPose.available
        ? (recordedPose.rightPresent ? rightWrist : restingRightWrist)
        : rightWrist);

      // Question signs carry a small brow raise and open-mouth marker; neutral
      // signs return to a relaxed expression.
      const expressionKey = normalizeDatasetKey(activeWord);
      const isQuestion = ["WHAT'S_UP", 'ANO_ANG_PANGALAN_MO', 'KUMUSTA_KA_NA'].includes(expressionKey);
      const browTilt = isQuestion ? 0.12 : 0;
      leftBrow.rotation.z = THREE.MathUtils.lerp(leftBrow.rotation.z, browTilt, 0.12);
      rightBrow.rotation.z = THREE.MathUtils.lerp(rightBrow.rotation.z, -browTilt, 0.12);
      mouth.scale.y = THREE.MathUtils.lerp(mouth.scale.y, isQuestion ? 1.65 : 0.72, 0.12);

      // Smooth Articulated 3-Phalanx Rotation (Right Hand)
      ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach((fn) => {
        const finger = rightHandObj.fingers[fn];
        const [c1, c2, c3, splay] = rightPose.curl[fn] || [0.3, 0.3, 0.3, 0];
        finger.baseGroup.rotation.x = THREE.MathUtils.lerp(finger.baseGroup.rotation.x, c1, 0.15);
        finger.pipGroup.rotation.x = THREE.MathUtils.lerp(finger.pipGroup.rotation.x, c2, 0.15);
        finger.dipGroup.rotation.x = THREE.MathUtils.lerp(finger.dipGroup.rotation.x, c3, 0.15);
        finger.baseGroup.rotation.z = THREE.MathUtils.lerp(finger.baseGroup.rotation.z, finger.config.spreadZ + splay, 0.15);
      });

      // Smooth Articulated 3-Phalanx Rotation (Left Hand)
      ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach((fn) => {
        const finger = leftHandObj.fingers[fn];
        const [c1, c2, c3, splay] = leftPose.curl[fn] || [0.3, 0.3, 0.3, 0];
        finger.baseGroup.rotation.x = THREE.MathUtils.lerp(finger.baseGroup.rotation.x, c1, 0.15);
        finger.pipGroup.rotation.x = THREE.MathUtils.lerp(finger.pipGroup.rotation.x, c2, 0.15);
        finger.dipGroup.rotation.x = THREE.MathUtils.lerp(finger.dipGroup.rotation.x, c3, 0.15);
        finger.baseGroup.rotation.z = THREE.MathUtils.lerp(finger.baseGroup.rotation.z, finger.config.spreadZ + splay, 0.15);
      });

      fitCameraToSigner(recordedPose);
      renderer.render(scene, camera);
    };

    animatePOV();

    // 7. Responsive Viewport Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      visibilityObserver?.disconnect();
      cancelAnimationFrame(animFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: minHeight || '340px',
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 35%, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.95) 100%)',
      }}
    >
      {poseLibraryStatus === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', color: '#cbd5e1', fontSize: '0.82rem', background: 'rgba(9, 13, 22, 0.38)', pointerEvents: 'none' }}>
          Loading recorded sign motion…
        </div>
      )}
      {poseLibraryStatus === 'fallback' && (
        <div style={{ position: 'absolute', left: '0.75rem', right: '0.75rem', bottom: '0.75rem', zIndex: 2, padding: '0.5rem 0.65rem', borderRadius: '8px', color: '#fbbf24', background: 'rgba(15, 23, 42, 0.88)', fontSize: '0.72rem', textAlign: 'center', pointerEvents: 'none' }}>
          Recorded pose data could not be loaded; showing the procedural fallback.
        </div>
      )}
    </div>
  );
}
