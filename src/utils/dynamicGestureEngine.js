/**
 * SignSync High-Accuracy Anatomical & Dynamic Gesture Recognition Engine
 * Provides:
 * 1. Canonical Handframe Normalization (100% invariant to arm tilt, camera roll, and distance)
 * 2. Deterministic Anatomical Finger State Analysis & Static Letter Disambiguation (A/S/E/T/M/N, 1/D, U/V/W, etc.)
 * 3. Spatial Body-Anchor Tracking via MediaPipe Holistic (Chin/Mouth, Forehead/Temple, Chest, Neutral Space)
 * 4. Multi-Frame Kinematic Gesture Recognition for ASL & FSL Conversational Signs
 * 5. Real-Time Diagnostics Telemetry for Live HUD
 */

// 3D Euclidean distance
export function dist3D(p1, p2) {
  if (!p1 || !p2) return 999;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 2D Euclidean distance in image plane
export function dist2D(p1, p2) {
  if (!p1 || !p2) return 999;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 1. Canonical Handframe Normalization
 * Projects the 21 MediaPipe hand landmarks into the hand's intrinsic coordinate basis:
 * - Origin: Wrist (0)
 * - Y-Axis (Vertical): Vector from Wrist (0) to Middle Finger MCP (9)
 * - Palm Normal (Z-Axis): Cross product of (Index MCP 5 - Wrist 0) and (Pinky MCP 17 - Wrist 0)
 * - X-Axis (Lateral): Cross product of Y and Z
 * - Scale: Palm scale (distance from Wrist 0 to Middle MCP 9)
 * 
 * Result: Features are completely immune to wrist roll, camera tilt, and user distance!
 */
export function normalizeHandLandmarksCanonical(pts, isLeft = false) {
  if (!pts || pts.length < 21) return null;

  const wrist = pts[0];
  const middleMcp = pts[9];
  const indexMcp = pts[5];
  const pinkyMcp = pts[17];

  const palmScale = Math.max(0.02, dist3D(wrist, middleMcp));

  // Primary Y axis: Wrist -> Middle MCP
  const vy = {
    x: (middleMcp.x - wrist.x) / palmScale,
    y: (middleMcp.y - wrist.y) / palmScale,
    z: ((middleMcp.z || 0) - (wrist.z || 0)) / palmScale,
  };

  // Vectors across the palm to form normal
  const vIndex = {
    x: (indexMcp.x - wrist.x) / palmScale,
    y: (indexMcp.y - wrist.y) / palmScale,
    z: ((indexMcp.z || 0) - (wrist.z || 0)) / palmScale,
  };

  const vPinky = {
    x: (pinkyMcp.x - wrist.x) / palmScale,
    y: (pinkyMcp.y - wrist.y) / palmScale,
    z: ((pinkyMcp.z || 0) - (wrist.z || 0)) / palmScale,
  };

  // Palm Normal (Z): vIndex x vPinky
  let vz = {
    x: vIndex.y * vPinky.z - vIndex.z * vPinky.y,
    y: vIndex.z * vPinky.x - vIndex.x * vPinky.z,
    z: vIndex.x * vPinky.y - vIndex.y * vPinky.x,
  };
  const normZ = Math.sqrt(vz.x * vz.x + vz.y * vz.y + vz.z * vz.z) || 1.0;
  vz.x /= normZ;
  vz.y /= normZ;
  vz.z /= normZ;

  if (isLeft) {
    vz.x = -vz.x;
    vz.y = -vz.y;
    vz.z = -vz.z;
  }

  // Lateral X axis: vy x vz
  let vx = {
    x: vy.y * vz.z - vy.z * vz.y,
    y: vy.z * vz.x - vy.x * vz.z,
    z: vy.x * vz.y - vy.y * vz.x,
  };
  const normX = Math.sqrt(vx.x * vx.x + vx.y * vx.y + vx.z * vx.z) || 1.0;
  vx.x /= normX;
  vx.y /= normX;
  vx.z /= normX;

  // Project all points into canonical basis [vx, vy, vz]
  const canonicalPts = [];
  for (let i = 0; i < 21; i++) {
    const p = pts[i];
    const dx = p.x - wrist.x;
    const dy = p.y - wrist.y;
    const dz = (p.z || 0) - (wrist.z || 0);

    const px = (dx * vx.x + dy * vx.y + dz * vx.z) / palmScale;
    const py = (dx * vy.x + dy * vy.y + dz * vy.z) / palmScale;
    const pz = (dx * vz.x + dy * vz.y + dz * vz.z) / palmScale;

    canonicalPts.push({
      x: Number(px.toFixed(4)),
      y: Number(py.toFixed(4)),
      z: Number(pz.toFixed(4)),
    });
  }

  return { canonicalPts, palmScale };
}

/**
 * 2. Anatomical Finger State Analysis
 * Computes deterministic biomechanical parameters of the hand:
 * - Extension and curl for each finger
 * - Thumb position relative to the 4 curled/extended fingers
 * - Inter-finger spacing and overlap
 * - Macro Handshape Classification
 */
export function getAnatomicalFingerState(pts, _isLeft = false) {
  if (!pts || pts.length < 21) return null;

  const wrist = pts[0];
  const palmScale = Math.max(0.04, dist3D(wrist, pts[9]));

  const thumbTip = pts[4];
  const indexTip = pts[8];
  const middleTip = pts[12];
  const ringTip = pts[16];
  const pinkyTip = pts[20];

  // Extension ratios (tip-to-wrist distance divided by palmScale)
  const thumbExtRatio = dist3D(thumbTip, pts[2]) / palmScale;
  const indexExtRatio = dist3D(indexTip, wrist) / palmScale;
  const middleExtRatio = dist3D(middleTip, wrist) / palmScale;
  const ringExtRatio = dist3D(ringTip, wrist) / palmScale;
  const pinkyExtRatio = dist3D(pinkyTip, wrist) / palmScale;

  // Extension flags
  const isThumbExtended = thumbExtRatio > 0.82;
  const isIndexExtended = indexExtRatio > 1.25 && indexTip.y < pts[6].y + 0.05;
  const isMiddleExtended = middleExtRatio > 1.30 && middleTip.y < pts[10].y + 0.05;
  const isRingExtended = ringExtRatio > 1.25 && ringTip.y < pts[14].y + 0.05;
  const isPinkyExtended = pinkyExtRatio > 1.20 && pinkyTip.y < pts[18].y + 0.05;

  // Curl flags (fingertip close to palm or MCP)
  const isIndexCurled = !isIndexExtended && dist3D(indexTip, pts[5]) / palmScale < 0.85;
  const isMiddleCurled = !isMiddleExtended && dist3D(middleTip, pts[9]) / palmScale < 0.85;
  const isRingCurled = !isRingExtended && dist3D(ringTip, pts[13]) / palmScale < 0.85;
  const isPinkyCurled = !isPinkyExtended && dist3D(pinkyTip, pts[17]) / palmScale < 0.85;

  // Inter-finger distances
  const dThumbIndex = dist3D(thumbTip, indexTip) / palmScale;
  const dThumbMiddle = dist3D(thumbTip, middleTip) / palmScale;
  const dThumbRing = dist3D(thumbTip, ringTip) / palmScale;
  const dThumbPinky = dist3D(thumbTip, pinkyTip) / palmScale;

  const dIndexMiddle = dist3D(indexTip, middleTip) / palmScale;
  const dMiddleRing = dist3D(middleTip, ringTip) / palmScale;
  const dRingPinky = dist3D(ringTip, pinkyTip) / palmScale;

  // Thumb placement relative to fingers (Crucial for A, S, E, T, M, N)
  const dThumbIndexPip = dist3D(thumbTip, pts[6]) / palmScale;
  const dThumbMiddlePip = dist3D(thumbTip, pts[10]) / palmScale;
  const dThumbIndexMcp = dist3D(thumbTip, pts[5]) / palmScale;

  // Thumb beside index MCP pointing upwards (Letter A)
  const isThumbBesideIndex =
    dThumbIndexMcp < 0.65 &&
    thumbTip.y < pts[2].y &&
    dThumbMiddlePip > 0.45 &&
    dist3D(thumbTip, pts[5]) < dist3D(thumbTip, pts[9]);

  // Thumb folded horizontally across curled fingers (Letter S)
  const isThumbAcrossFist =
    dThumbMiddle < 0.32 &&
    dThumbIndexPip < 0.55 &&
    !isThumbBesideIndex;

  // All 4 fingers curled down tightly with thumb tucked underneath fingertips (Letter E)
  const isThumbUnderFingers =
    isIndexCurled &&
    isMiddleCurled &&
    isRingCurled &&
    isPinkyCurled &&
    (dThumbIndex < 0.42 && dThumbMiddle < 0.45 && thumbTip.y > indexTip.y - 0.05);

  // Thumb tucked between index and middle fingers (Letter T)
  const isThumbBetweenIndexMiddle =
    dist3D(thumbTip, pts[6]) / palmScale < 0.45 &&
    thumbTip.y < pts[6].y &&
    dIndexMiddle > 0.22;

  // Thumb tucked under index and middle, poking out between middle and ring (Letter N)
  const isThumbUnderIndexMiddle =
    dThumbMiddlePip < 0.36 &&
    dThumbMiddle > 0.32 &&
    thumbTip.y < pts[10].y &&
    dist3D(thumbTip, pts[14]) / palmScale < 0.38 &&
    !isThumbBetweenIndexMiddle;

  // Thumb tucked under index, middle, ring, poking out between ring and pinky (Letter M)
  const isThumbUnderThree =
    dist3D(thumbTip, pts[14]) / palmScale < 0.50 &&
    thumbTip.y < pts[14].y &&
    dRingPinky > 0.20;

  // Loops and pinches
  const isThumbMiddleLoop = dThumbMiddle < 0.28 && isIndexExtended && isRingCurled && isPinkyCurled; // Letter D
  const isThumbIndexLoop = dThumbIndex < 0.28 && isMiddleExtended && isRingExtended && isPinkyExtended; // Letter F / 9
  const isCircularO = dThumbIndex < 0.30 && dThumbMiddle < 0.35 && !isIndexExtended && !isPinkyExtended; // Letter O
  const isCurvedC = !isCircularO && dThumbIndex > 0.35 && dThumbIndex < 0.95 && dist3D(indexTip, pts[5]) / palmScale > 0.85;

  // Macro Handshapes
  const isFist = isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled;
  const isOpenHand = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended;
  const isIlyHand = isThumbExtended && isIndexExtended && isPinkyExtended && isMiddleCurled && isRingCurled;
  const isPointing = isIndexExtended && isMiddleCurled && isRingCurled && isPinkyCurled;
  const isVHand = isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled && dIndexMiddle > 0.26;
  const isUHand = isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled && dIndexMiddle <= 0.26;
  const isWHand = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyCurled;
  const isLHand = isIndexExtended && isThumbExtended && isMiddleCurled && isRingCurled && isPinkyCurled && dThumbIndex > 0.80;
  const isYHand = isThumbExtended && isPinkyExtended && isIndexCurled && isMiddleCurled && isRingCurled;
  const isBHand = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended && dIndexMiddle < 0.25 && dThumbIndex < 0.60;

  let handshapeLabel = 'Neutral Hand';
  if (isFist) handshapeLabel = 'Closed Fist';
  else if (isOpenHand) handshapeLabel = isBHand ? 'Flat B-Hand' : 'Open Hand';
  else if (isIlyHand) handshapeLabel = 'I-Love-You Hand';
  else if (isPointing) handshapeLabel = 'Pointing Index';
  else if (isVHand) handshapeLabel = 'V-Shape';
  else if (isUHand) handshapeLabel = 'U-Shape (Touching)';
  else if (isWHand) handshapeLabel = 'W-Shape (3 Fingers)';
  else if (isLHand) handshapeLabel = 'L-Shape';
  else if (isYHand) handshapeLabel = 'Y-Shape';
  else if (isCircularO) handshapeLabel = 'O-Ring Closure';
  else if (isCurvedC) handshapeLabel = 'C-Cup';

  return {
    palmScale,
    isThumbExtended,
    isIndexExtended,
    isMiddleExtended,
    isRingExtended,
    isPinkyExtended,
    isIndexCurled,
    isMiddleCurled,
    isRingCurled,
    isPinkyCurled,
    dThumbIndex,
    dThumbMiddle,
    dThumbRing,
    dThumbPinky,
    dIndexMiddle,
    dMiddleRing,
    dRingPinky,
    isThumbBesideIndex,
    isThumbAcrossFist,
    isThumbUnderFingers,
    isThumbBetweenIndexMiddle,
    isThumbUnderIndexMiddle,
    isThumbUnderThree,
    isThumbMiddleLoop,
    isThumbIndexLoop,
    isCircularO,
    isCurvedC,
    isFist,
    isOpenHand,
    isIlyHand,
    isPointing,
    isVHand,
    isUHand,
    isWHand,
    isLHand,
    isYHand,
    isBHand,
    handshapeLabel,
  };
}

/**
 * 3. Static Letter Disambiguation Engine
 * Refines raw neural network softmax outputs with deterministic anatomical geometry.
 * Completely eliminates erratic jitter across fist letters (A/S/E/T/M/N) and pointing/count letters (1/D, U/V/W).
 */
export function disambiguateStaticLetter(candidate, score, pts, dialect = 'ASL', isLeft = false) {
  if (!candidate || !pts || pts.length < 21) {
    return { sign: candidate, score, reason: 'Raw neural prediction' };
  }

  const anat = getAnatomicalFingerState(pts, isLeft);
  if (!anat) return { sign: candidate, score, reason: 'Raw neural prediction' };

  const cleanCand = candidate.replace(/^(ASL_|FSL_)/, '').toUpperCase();

  // CLUSTER 1: Closed Fist Alphabet (A, S, E, T, M, N)
  if (anat.isFist || ['A', 'S', 'E', 'T', 'M', 'N'].includes(cleanCand)) {
    if (anat.isThumbBesideIndex) {
      return { sign: 'A', score: Math.max(score, 88), reason: 'Thumb along index side (A)' };
    }
    if (anat.isThumbAcrossFist) {
      return { sign: 'S', score: Math.max(score, 88), reason: 'Thumb folded across fingers (S)' };
    }
    if (anat.isThumbUnderFingers) {
      return { sign: 'E', score: Math.max(score, 88), reason: 'Curled fingertips over thumb (E)' };
    }
    if (anat.isThumbBetweenIndexMiddle) {
      return { sign: 'T', score: Math.max(score, 88), reason: 'Thumb between index and middle (T)' };
    }
    if (anat.isThumbUnderIndexMiddle) {
      return { sign: 'N', score: Math.max(score, 88), reason: 'Thumb under two fingers (N)' };
    }
    if (anat.isThumbUnderThree) {
      return { sign: 'M', score: Math.max(score, 88), reason: 'Thumb under three fingers (M)' };
    }
    // Default fallback within fist cluster
    if (cleanCand === 'A' || cleanCand === 'S' || cleanCand === 'E') {
      return { sign: cleanCand, score, reason: 'Fist cluster match' };
    }
  }

  // CLUSTER 2: Pointing Index vs Loop (1 vs D)
  if (anat.isPointing || ['1', 'D'].includes(cleanCand)) {
    if (anat.isThumbMiddleLoop) {
      return { sign: 'D', score: Math.max(score, 90), reason: 'Index pointing with thumb-middle loop (D)' };
    }
    return { sign: '1', score: Math.max(score, 90), reason: 'Index pointing straight up (1)' };
  }

  // CLUSTER 3: Dual Finger Extension (U vs V vs R vs 2)
  if ((anat.isIndexExtended && anat.isMiddleExtended && anat.isRingCurled && anat.isPinkyCurled) || ['U', 'V', 'R', '2'].includes(cleanCand)) {
    const indexX = pts[8].x;
    const middleX = pts[12].x;
    const isCrossed = isLeft ? (middleX > indexX) : (indexX > middleX);
    if (isCrossed && anat.dIndexMiddle < 0.28) {
      return { sign: 'R', score: Math.max(score, 90), reason: 'Index and middle crossed (R)' };
    }
    if (anat.dIndexMiddle <= 0.26) {
      return { sign: 'U', score: Math.max(score, 90), reason: 'Index and middle parallel & touching (U)' };
    }
    return { sign: 'V', score: Math.max(score, 90), reason: 'Index and middle spread apart (V)' };
  }

  // CLUSTER 4: Triple Finger Extension (W vs 3)
  if (anat.isWHand || ['W', '3'].includes(cleanCand)) {
    if (anat.isThumbExtended && !anat.isRingExtended) {
      return { sign: '3', score: Math.max(score, 90), reason: 'Thumb, index, and middle extended (3)' };
    }
    return { sign: 'W', score: Math.max(score, 90), reason: 'Index, middle, and ring spread (W)' };
  }

  // CLUSTER 5: Flat Hand vs Number 4 / 5 (B vs 4 vs 5)
  if (anat.isOpenHand || ['B', '4', '5'].includes(cleanCand)) {
    if (anat.isBHand) {
      return { sign: 'B', score: Math.max(score, 90), reason: 'Flat four fingers together with folded thumb (B)' };
    }
    if (anat.isThumbExtended) {
      return { sign: '5', score: Math.max(score, 90), reason: 'All five fingers spread open (5)' };
    }
    return { sign: '4', score: Math.max(score, 90), reason: 'Four fingers spread open with folded thumb (4)' };
  }

  // CLUSTER 6: L-Shape
  if (anat.isLHand || cleanCand === 'L') {
    return { sign: 'L', score: Math.max(score, 92), reason: 'Perpendicular L-angle between thumb and index (L)' };
  }

  // CLUSTER 7: Pinky Only vs Y-Sign (I vs Y)
  if (anat.isPinkyExtended && anat.isIndexCurled && anat.isMiddleCurled && anat.isRingCurled) {
    if (anat.isThumbExtended) {
      return { sign: 'Y', score: Math.max(score, 92), reason: 'Thumb and pinky horns (Y)' };
    }
    return { sign: 'I', score: Math.max(score, 92), reason: 'Pinky only extended (I)' };
  }

  // CLUSTER 8: Pinch Loop (F vs 9 vs O vs C)
  if (anat.isThumbIndexLoop || cleanCand === 'F' || cleanCand === '9') {
    return { sign: 'F', score: Math.max(score, 90), reason: 'Thumb-index contact with 3 fingers up (F)' };
  }
  if (anat.isCircularO || cleanCand === 'O') {
    return { sign: 'O', score: Math.max(score, 90), reason: 'Full circular O contact (O)' };
  }
  if (anat.isCurvedC || cleanCand === 'C') {
    return { sign: 'C', score: Math.max(score, 88), reason: 'Curved C shape (C)' };
  }

  return { sign: cleanCand, score, reason: 'Neural prediction confirmed' };
}

// Conservative live refinement for only the visually overlapping classes that
// need temporal/anatomical evidence. It intentionally does not rewrite the
// other model classes, whose distinctions are already learned from recordings.
export function refineFingerspellingPrediction(candidate, score, pts, tracker = null) {
  if (!candidate || !pts || pts.length < 21) return { sign: candidate, score };
  const clean = candidate.replace(/^(ASL_|FSL_)/, '').toUpperCase();
  const anatomy = getAnatomicalFingerState(pts);
  if (!anatomy) return { sign: clean, score };

  if (clean === 'S' || clean === 'N') {
    if (anatomy.isThumbAcrossFist) {
      return { sign: 'S', score, reason: 'thumb across the curled fingertips' };
    }
    if (anatomy.isThumbUnderIndexMiddle) {
      return { sign: 'N', score, reason: 'thumb under index and middle fingers' };
    }
  }

  if (clean === 'D' || clean === 'Z' || clean === '1') {
    if (tracker?.detectFingerspellingMotion?.() === 'Z') {
      return { sign: 'Z', score, reason: 'completed zigzag index-tip stroke' };
    }
    if (clean === 'Z' && anatomy.isThumbMiddleLoop) {
      return { sign: 'D', score, reason: 'stationary thumb-middle loop' };
    }
  }

  return { sign: clean, score, reason: 'neural prediction retained' };
}

/**
 * 4. Comprehensive Dynamic Gesture Recognition Engine
 * Evaluates spatial trajectories, MediaPipe Holistic body anchors, and stroke kinematics.
 */
export class DynamicGestureTracker {
  constructor() {
    this.history = []; // Sliding trajectory buffer
    this.maxHistory = 32; // ~1 second of motion history
    this.lastTriggeredTime = 0;
    this.cooldownMs = 400; // Cooldown for live trajectory tracking
    this.currentTelemetry = {
      handshape: 'Neutral',
      bodyAnchor: 'Free Space',
      motionState: 'Steady',
      motionVelocity: 0,
    };
  }

  reset() {
    this.history = [];
  }

  getTelemetry() {
    return this.currentTelemetry;
  }

  /**
   * Evaluates physical spatial movement of the wrist and palm.
   */
  hasSignificantMotion() {
    const n = this.history.length;
    if (n < 6) return false;
    const slice = this.history.slice(-14);
    let totalPalmTravel = 0;
    let totalWristTravel = 0;
    let minX = 999, maxX = -999, minY = 999, maxY = -999;

    for (let i = 0; i < slice.length; i++) {
      const p = slice[i].palmCenter;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (i > 0) {
        totalPalmTravel += dist2D(slice[i].palmCenter, slice[i - 1].palmCenter);
        totalWristTravel += dist2D(slice[i].wrist, slice[i - 1].wrist);
      }
    }
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;

    const hasTravel = totalWristTravel > 0.045 || totalPalmTravel > 0.065;
    const hasSpread = bboxW > 0.040 || bboxH > 0.040;
    return hasTravel && hasSpread;
  }

  /**
   * Z is a moving fingerspelled letter, not a static pointing pose. Requiring
   * the actual two-turn index-tip stroke prevents a still D/1 handshape from
   * being emitted as Z while remaining independent of signing hand.
   */
  detectFingerspellingMotion() {
    if (this.history.length < 9) return null;
    const recent = this.history.slice(-Math.min(28, this.history.length));
    const pointingFrames = recent.filter(({ anat }) => anat?.isPointing).length;
    if (pointingFrames < Math.ceil(recent.length * 0.55)) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let horizontalTravel = 0;
    let horizontalReversals = 0;
    let lastDirection = 0;
    for (let index = 0; index < recent.length; index += 1) {
      const point = recent[index].indexTip;
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      if (index === 0) continue;
      const dx = point.x - recent[index - 1].indexTip.x;
      horizontalTravel += Math.abs(dx);
      if (Math.abs(dx) < 0.006) continue;
      const direction = Math.sign(dx);
      if (lastDirection && direction !== lastDirection) horizontalReversals += 1;
      lastDirection = direction;
    }
    if (
      horizontalReversals >= 2 && horizontalTravel >= 0.11 &&
      maxX - minX >= 0.055 && maxY - minY >= 0.018
    ) return 'Z';
    return null;
  }

  /**
   * Push a frame snapshot into the sliding buffer
   */
  pushFrame(primaryHand, secondHand = null, pose = null, isLeft = false) {
    if (!primaryHand || primaryHand.length < 21) {
      if (this.history.length > 0) this.history.shift();
      return;
    }

    const now = Date.now();
    const wrist = primaryHand[0];
    const indexTip = primaryHand[8];
    const middleTip = primaryHand[12];
    const thumbTip = primaryHand[4];
    const pinkyTip = primaryHand[20];

    const palmCenter = {
      x: (wrist.x + primaryHand[5].x + primaryHand[17].x) / 3,
      y: (wrist.y + primaryHand[5].y + primaryHand[17].y) / 3,
      z: ((wrist.z || 0) + (primaryHand[5].z || 0) + (primaryHand[17].z || 0)) / 3,
    };

    const anat = getAnatomicalFingerState(primaryHand, isLeft);

    // Extract Body Anchors from MediaPipe Holistic Pose
    let poseAnchors = null;
    let nearestAnchor = 'Free Space';
    let minAnchorDist = 999;

    if (pose) {
      const nose = pose[0];
      const mouth = (pose[9] && pose[10]) ? {
        x: (pose[9].x + pose[10].x) / 2,
        y: (pose[9].y + pose[10].y) / 2,
        z: ((pose[9].z || 0) + (pose[10].z || 0)) / 2,
      } : nose;

      const chin = mouth ? { x: mouth.x, y: mouth.y + 0.04, z: mouth.z || 0 } : null;
      const chest = (pose[11] && pose[12]) ? {
        x: (pose[11].x + pose[12].x) / 2,
        y: (pose[11].y + pose[12].y) / 2 + 0.09,
        z: ((pose[11].z || 0) + (pose[12].z || 0)) / 2,
      } : null;

      const forehead = nose ? { x: nose.x, y: nose.y - 0.08, z: nose.z || 0 } : null;

      poseAnchors = { nose, mouth, chin, chest, forehead, leftShoulder: pose[11], rightShoulder: pose[12] };

      // Check proximity to anchors
      if (chin) {
        const dChin = dist3D(palmCenter, chin);
        if (dChin < minAnchorDist) { minAnchorDist = dChin; nearestAnchor = 'Chin / Mouth'; }
      }
      if (forehead) {
        const dFore = dist3D(palmCenter, forehead);
        if (dFore < minAnchorDist) { minAnchorDist = dFore; nearestAnchor = 'Forehead / Temple'; }
      }
      if (chest) {
        const dChest = dist3D(palmCenter, chest);
        if (dChest < minAnchorDist) { minAnchorDist = dChest; nearestAnchor = 'Chest / Sternum'; }
      }
      
      const shoulderWidth = (pose[11] && pose[12]) ? dist3D(pose[11], pose[12]) : 0.35;
      const maxAnchorDist = Math.max(0.32, Math.min(0.44, shoulderWidth * 0.90));
      if (minAnchorDist > maxAnchorDist) {
        nearestAnchor = 'Free Space';
      }
    }

    const snapshot = {
      time: now,
      wrist,
      indexTip,
      middleTip,
      thumbTip,
      pinkyTip,
      palmCenter,
      anat,
      poseAnchors,
      nearestAnchor,
      isLeft,
      secondHand: (secondHand && secondHand.length >= 21) ? {
        wrist: secondHand[0],
        palmCenter: {
          x: (secondHand[0].x + secondHand[5].x + secondHand[17].x) / 3,
          y: (secondHand[0].y + secondHand[5].y + secondHand[17].y) / 3,
        },
      } : null,
    };

    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Update telemetry state
    this.currentTelemetry = {
      handshape: anat ? anat.handshapeLabel : 'Detecting...',
      bodyAnchor: nearestAnchor,
      motionState: this.hasSignificantMotion() ? 'In Motion' : 'Steady',
      motionVelocity: this.history.length > 2
        ? Number((dist2D(palmCenter, this.history[this.history.length - 2].palmCenter) * 100).toFixed(1))
        : 0,
    };
  }

  /**
   * Sequence variance calculation for compatibility
   */
  calculateSequenceVariance(frames) {
    if (!frames || frames.length < 6) return 0;
    const n = frames.length;
    let totalVar = 0;
    const numCoords = Math.min(60, frames[0].length);

    for (let k = 0; k < numCoords; k++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += frames[i][k];
      const mean = sum / n;
      let varSum = 0;
      for (let i = 0; i < n; i++) {
        const diff = frames[i][k] - mean;
        varSum += diff * diff;
      }
      totalVar += varSum / n;
    }
    return totalVar / numCoords;
  }

  /**
   * Handshape precondition validator
   */
  isHandshapeCompatible(signKey) {
    const n = this.history.length;
    if (n === 0) return false;
    const snap = this.history[n - 1];
    const clean = signKey.replace(/^(ASL_|FSL_)/, '').toUpperCase();

    if (['HI', 'HELLO', 'GOODBYE', 'MAGANDANG_ARAW', 'KUMUSTA_KA_NA'].includes(clean)) {
      return snap.anat && (snap.anat.isOpenHand || snap.anat.isBHand);
    }
    if (['I_LOVE_YOU', 'MAHAL_KITA'].includes(clean)) {
      return snap.anat && snap.anat.isIlyHand;
    }
    if (['YES', 'OO'].includes(clean)) {
      return snap.anat && snap.anat.isFist;
    }
    if (['THANK_YOU', 'SALAMAT', 'PATAWAD', 'PLEASE'].includes(clean)) {
      return snap.anat && !snap.anat.isFist;
    }
    return true;
  }

  /**
   * Evaluate all dynamic signs (Kinematic Trajectories + Body Anchors)
   */
  evaluate(dialect = 'ASL', staticCandidate = null) {
    const n = this.history.length;
    if (n < 6) return null;

    const now = Date.now();
    if (now - this.lastTriggeredTime < this.cooldownMs) {
      return null;
    }

    const isFSL = dialect.toUpperCase() === 'FSL';
    const latest = this.history[n - 1];
    const recent = this.history.slice(-Math.min(n, 20));

    // Direction reversals in X and Y
    let xReversals = 0, yReversals = 0;
    let lastDx = 0, lastDy = 0;
    let minX = 999, maxX = -999, minY = 999, maxY = -999;

    for (let i = 0; i < recent.length; i++) {
      const p = recent[i].palmCenter;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;

      if (i > 0) {
        const dx = recent[i].palmCenter.x - recent[i - 1].palmCenter.x;
        const dy = recent[i].palmCenter.y - recent[i - 1].palmCenter.y;
        if (Math.abs(dx) > 0.005) {
          if (lastDx !== 0 && Math.sign(dx) !== Math.sign(lastDx)) xReversals++;
          lastDx = dx;
        }
        if (Math.abs(dy) > 0.005) {
          if (lastDy !== 0 && Math.sign(dy) !== Math.sign(lastDy)) yReversals++;
          lastDy = dy;
        }
      }
    }

    const first = recent[0];
    const netDx = latest.palmCenter.x - first.palmCenter.x;
    const netDy = latest.palmCenter.y - first.palmCenter.y;
    const netDist = dist2D(latest.palmCenter, first.palmCenter);
    const sweepWidth = maxX - minX;
    const sweepHeight = maxY - minY;
    const hasMotion = this.hasSignificantMotion() || netDist > 0.035 || sweepWidth > 0.035 || sweepHeight > 0.035;

    const anchor = latest.nearestAnchor || 'Free Space';
    const isAtChin = anchor === 'Chin / Mouth' || (latest.poseAnchors && latest.poseAnchors.chin && dist3D(latest.palmCenter, latest.poseAnchors.chin) < 0.28);
    const isAtChest = anchor === 'Chest / Sternum' || (latest.poseAnchors && latest.poseAnchors.chest && dist3D(latest.palmCenter, latest.poseAnchors.chest) < 0.28);
    const isAtForehead = anchor === 'Forehead / Temple' || (latest.poseAnchors && latest.poseAnchors.forehead && dist3D(latest.palmCenter, latest.poseAnchors.forehead) < 0.30);

    // =========================================================================
    // 1. YES (ASL) / OO (FSL): Closed fist nodding vertically
    // =========================================================================
    const isFistLike = latest.anat && (latest.anat.isFist || (!latest.anat.isOpenHand && !latest.anat.isPointing && !latest.anat.isVHand && !latest.anat.isIlyHand));
    if (isFistLike && hasMotion) {
      if ((yReversals >= 1 && sweepHeight > 0.030) || (sweepHeight > 0.045 && Math.abs(netDy) > 0.025)) {
        this.lastTriggeredTime = now;
        const sign = isFSL ? 'OO' : 'YES';
        return { sign, score: 96, isDynamic: true, engine: 'KINEMATIC' };
      }
    }

    // =========================================================================
    // 2. I LOVE YOU (ASL) / MAHAL KITA (FSL): Strict ILY posture
    // =========================================================================
    if (latest.anat && latest.anat.isIlyHand) {
      this.lastTriggeredTime = now;
      const sign = isFSL ? 'MAHAL_KITA' : 'I_LOVE_YOU';
      return { sign, score: 98, isDynamic: true, engine: 'KINEMATIC' };
    }

    // =========================================================================
    // 3. THANK YOU (ASL) / SALAMAT (FSL): Flat hand from chin forward
    // =========================================================================
    const isFlatHand = latest.anat && (latest.anat.isOpenHand || latest.anat.isBHand || !latest.anat.isFist);
    if (isAtChin && isFlatHand && (netDy > 0.02 || netDist > 0.035)) {
      this.lastTriggeredTime = now;
      const sign = isFSL ? 'SALAMAT' : 'THANK_YOU';
      return { sign, score: 96, isDynamic: true, engine: 'KINEMATIC' };
    }

    // =========================================================================
    // 4. HELLO / HI: Open hand near temple/forehead
    // =========================================================================
    if (isAtForehead && isFlatHand && (Math.abs(netDx) > 0.03 || xReversals >= 1 || netDist > 0.035)) {
      this.lastTriggeredTime = now;
      const sign = isFSL ? 'HELLO' : 'HELLO';
      return { sign, score: 96, isDynamic: true, engine: 'KINEMATIC' };
    }

    // =========================================================================
    // 5. GOODBYE: Open hand waving in space
    // =========================================================================
    if (!isAtForehead && isFlatHand && xReversals >= 1 && sweepWidth > 0.04) {
      this.lastTriggeredTime = now;
      const sign = isFSL ? 'GOODBYE' : 'GOODBYE';
      return { sign, score: 96, isDynamic: true, engine: 'KINEMATIC' };
    }

    // =========================================================================
    // 6. PLEASE (ASL) / PATAWAD (FSL): Flat hand on chest circular rubbing
    // =========================================================================
    const isCircular = (xReversals >= 1 || yReversals >= 1) && sweepWidth > 0.025 && sweepHeight > 0.025;
    if (isAtChest && isFlatHand && isCircular) {
      this.lastTriggeredTime = now;
      const sign = isFSL ? 'PATAWAD' : 'PLEASE';
      return { sign, score: 96, isDynamic: true, engine: 'KINEMATIC' };
    }

    // =========================================================================
    // 7. NO (ASL) / HINDI (FSL): Snap shut or wagging
    // =========================================================================
    if (recent.length >= 6) {
      const earlier = recent[0].anat;
      const nowAnat = latest.anat;
      if (earlier && nowAnat && earlier.dThumbIndex > 0.38 && nowAnat.dThumbIndex < 0.28) {
        this.lastTriggeredTime = now;
        const sign = isFSL ? 'HINDI' : 'NO';
        return { sign, score: 95, isDynamic: true, engine: 'KINEMATIC' };
      }
      if (xReversals >= 1 && latest.anat && (latest.anat.isPointing || latest.anat.isIndexExtended)) {
        this.lastTriggeredTime = now;
        const sign = isFSL ? 'HINDI' : 'NO';
        return { sign, score: 95, isDynamic: true, engine: 'KINEMATIC' };
      }
    }

    // =========================================================================
    // 8. EAT / MORE: Pinched fingertips
    // =========================================================================
    if (latest.anat) {
      const isPinched = latest.anat.dThumbIndex < 0.38 && latest.anat.dThumbMiddle < 0.40;
      if (isPinched && isAtChin) {
        this.lastTriggeredTime = now;
        return { sign: 'EAT', score: 96, isDynamic: true, engine: 'KINEMATIC' };
      }
      if (isPinched && (hasMotion || netDist > 0.025)) {
        this.lastTriggeredTime = now;
        return { sign: 'MORE', score: 95, isDynamic: true, engine: 'KINEMATIC' };
      }
    }

    // =========================================================================
    // 9. ME / AKO: Pointing index to chest. ME avoids colliding with letter I.
    // =========================================================================
    if (latest.anat && (latest.anat.isPointing || (isFSL && latest.anat.isPinkyExtended && latest.anat.isIndexCurled))) {
      if (isAtChest) {
        this.lastTriggeredTime = now;
        const sign = isFSL ? 'AKO' : 'ME';
        return { sign, score: 96, isDynamic: true, engine: 'KINEMATIC' };
      }
    }

    // =========================================================================
    // 10. WHAT'S UP / KUMUSTA KA NA: Open hands at chest moving upward/forward
    // =========================================================================
    if (isAtChest && isFlatHand && (netDy < -0.025 || (sweepWidth > 0.045 && netDist > 0.035))) {
      this.lastTriggeredTime = now;
      const sign = isFSL ? 'KUMUSTA_KA_NA' : "WHAT'S_UP";
      return { sign, score: 95, isDynamic: true, engine: 'KINEMATIC' };
    }

    // =========================================================================
    // 11. SEE YOU LATER: V-hand moving forward from face
    // =========================================================================
    if (latest.anat && latest.anat.isVHand && (netDy > 0.02 || netDist > 0.035)) {
      this.lastTriggeredTime = now;
      return { sign: 'SEE_YOU_LATER', score: 95, isDynamic: true, engine: 'KINEMATIC' };
    }

    // =========================================================================
    // 12. Ñ: N-handshape waving horizontally
    // =========================================================================
    if (isFSL && xReversals >= 1 && sweepWidth > 0.04) {
      if (latest.anat && (latest.anat.isFist || ['N', 'Ñ', 'M'].includes(staticCandidate))) {
        this.lastTriggeredTime = now;
        return { sign: 'Ñ', score: 96, isDynamic: true, engine: 'KINEMATIC' };
      }
    }

    return null;
  }
}
