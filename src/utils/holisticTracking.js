const DEFAULT_MAX_GAP_MS = Object.freeze({
  hand: 220,
  pose: 650,
  face: 650,
});

const cloneLandmarks = (landmarks) => landmarks?.map((point) => ({ ...point })) || null;

const STREAM_ALPHA = Object.freeze({ hand: 0.68, pose: 0.52, face: 0.46 });

const isFinitePoint = (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)
  && (point.z == null || Number.isFinite(point.z));

const hasUsableGeometry = (landmarks, kind) => {
  const minimum = kind === 'hand' ? 21 : kind === 'pose' ? 25 : 100;
  if (!landmarks || landmarks.length < minimum || !landmarks.every(isFinitePoint)) return false;
  if (kind === 'hand') {
    const wrist = landmarks[0];
    const middle = landmarks[9];
    const palmScale = Math.hypot(wrist.x - middle.x, wrist.y - middle.y, (wrist.z || 0) - (middle.z || 0));
    return palmScale >= 0.018 && palmScale <= 0.65;
  }
  if (kind === 'pose') {
    const anchors = [landmarks[0], landmarks[11], landmarks[12], landmarks[13], landmarks[14]];
    return anchors.filter((point) => point && (point.visibility ?? 1) >= 0.35).length >= 3;
  }
  return true;
};

const smoothLandmarks = (previous, current, baseAlpha) => {
  if (!current) return null;
  if (!previous || previous.length !== current.length) return cloneLandmarks(current);
  return current.map((point, index) => {
    const old = previous[index];
    if (!old) return { ...point };
    const movement = Math.hypot(
      point.x - old.x,
      point.y - old.y,
      (point.z || 0) - (old.z || 0),
    );
    // Stable landmarks receive stronger filtering, while deliberate fast hand
    // motion remains responsive. Low-visibility pose points update cautiously.
    const visibilityFactor = Math.max(0.55, point.visibility ?? 1);
    const alpha = Math.min(0.92, Math.max(0.28, (baseAlpha + movement * 2.4) * visibilityFactor));
    return {
      ...point,
      x: old.x + (point.x - old.x) * alpha,
      y: old.y + (point.y - old.y) * alpha,
      z: (old.z || 0) + ((point.z || 0) - (old.z || 0)) * alpha,
      visibility: point.visibility ?? old.visibility,
    };
  });
};

/**
 * Keeps MediaPipe's independent face, pose and hand streams visually and
 * numerically continuous through brief motion blur/occlusion. Recovered
 * landmarks retain the last known geometry only for a bounded interval; the
 * recognizer can therefore finish a dynamic stroke without creating a
 * permanent "stuck" skeleton.
 */
export class HolisticTrackingStabilizer {
  constructor({ landmarkAlpha = null, streamAlpha = {}, maxGapMs = {} } = {}) {
    this.landmarkAlpha = landmarkAlpha;
    this.streamAlpha = { ...STREAM_ALPHA, ...streamAlpha };
    this.maxGapMs = { ...DEFAULT_MAX_GAP_MS, ...maxGapMs };
    this.reset();
  }

  reset() {
    this.streams = {
      rightHandLandmarks: { value: null, seenAt: 0, kind: 'hand' },
      leftHandLandmarks: { value: null, seenAt: 0, kind: 'hand' },
      poseLandmarks: { value: null, seenAt: 0, kind: 'pose' },
      faceLandmarks: { value: null, seenAt: 0, kind: 'face' },
    };
  }

  update(results, now = Date.now()) {
    const stable = { ...(results || {}), _timestamp: now, _recovered: {} };
    for (const [key, stream] of Object.entries(this.streams)) {
      const incoming = results?.[key];
      if (hasUsableGeometry(incoming, stream.kind)) {
        const alpha = this.landmarkAlpha ?? this.streamAlpha[stream.kind];
        stream.value = smoothLandmarks(stream.value, incoming, alpha);
        stream.seenAt = now;
        stable[key] = stream.value;
        stable._recovered[key] = false;
      } else if (stream.value && now - stream.seenAt <= this.maxGapMs[stream.kind]) {
        stable[key] = stream.value;
        stable._recovered[key] = true;
      } else {
        stream.value = null;
        stream.seenAt = 0;
        stable[key] = null;
        stable._recovered[key] = false;
      }
    }
    return stable;
  }
}

/**
 * Returns the hand streams safe to use for recognition. When one hand has just
 * appeared and the opposite hand is only a dropout-recovery ghost, the ghost
 * is excluded so a hand switch cannot look like a two-handed sign.
 */
export function selectActiveHandObjects(results) {
  if (!results) return [];
  const hands = [
    ['rightHandLandmarks', false],
    ['leftHandLandmarks', true],
  ].flatMap(([key, isLeft]) => {
    const landmarks = results[key];
    if (!hasUsableGeometry(landmarks, 'hand')) return [];
    return [{ landmarks, isLeft, recovered: Boolean(results._recovered?.[key]) }];
  });
  const fresh = hands.filter((hand) => !hand.recovered);
  return fresh.length ? fresh : hands;
}

export const isFreshHolisticResult = (results, now = Date.now(), maxAgeMs = 700) =>
  Boolean(results?._timestamp && now - results._timestamp <= maxAgeMs);
