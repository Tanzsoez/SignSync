const distance3D = (first, second) => Math.hypot(
  first.x - second.x,
  first.y - second.y,
  (first.z || 0) - (second.z || 0),
);

const straightness = (hand, indices) => {
  const direct = distance3D(hand[indices[0]], hand[indices.at(-1)]);
  let path = 0;
  for (let index = 1; index < indices.length; index += 1) {
    path += distance3D(hand[indices[index - 1]], hand[indices[index]]);
  }
  return path > 0 ? direct / path : 0;
};

const extensionRatio = (hand, mcp, tip, palmScale) => distance3D(hand[mcp], hand[tip]) / palmScale;

export const isIsolatedMiddleFingerGesture = (hand) => {
  if (!hand || hand.length < 21 || hand.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return false;
  }

  const palmScale = distance3D(hand[0], hand[9]);
  if (!Number.isFinite(palmScale) || palmScale < 0.025) return false;

  const middleExtended = extensionRatio(hand, 9, 12, palmScale) > 1.45
    && straightness(hand, [9, 10, 11, 12]) > 0.86
    && hand[12].y < hand[10].y;
  const foldedFingers = [
    extensionRatio(hand, 5, 8, palmScale),
    extensionRatio(hand, 13, 16, palmScale),
    extensionRatio(hand, 17, 20, palmScale),
  ].filter((ratio) => ratio < 1.08).length;

  // Requiring all three surrounding fingers to be folded keeps legitimate
  // multi-finger signs and ordinary transition frames out of this filter.
  return middleExtended && foldedFingers === 3;
};

export class GestureRejectionGate {
  constructor(requiredFrames = 6, releaseFrames = 3, nominalFrameMs = 1000 / 30) {
    this.requiredFrames = requiredFrames;
    this.releaseFrames = releaseFrames;
    this.nominalFrameMs = nominalFrameMs;
    this.requiredMs = requiredFrames * nominalFrameMs;
    this.releaseMs = releaseFrames * nominalFrameMs;
    this.reset();
  }

  update(isRejectedCandidate, timestamp) {
    const now = Number.isFinite(timestamp)
      ? timestamp
      : (this.lastTimestamp ?? 0) + this.nominalFrameMs;
    const elapsed = this.lastTimestamp == null
      ? this.nominalFrameMs
      : Math.max(1, now - this.lastTimestamp);
    this.lastTimestamp = now;
    if (isRejectedCandidate) {
      this.candidateFrames += 1;
      this.clearFrames = 0;
      this.candidateMs += elapsed;
      this.clearMs = 0;
      if (this.candidateMs >= this.requiredMs) this.rejected = true;
    } else {
      this.candidateFrames = 0;
      this.clearFrames += 1;
      this.candidateMs = 0;
      this.clearMs += elapsed;
      if (this.clearMs >= this.releaseMs) this.rejected = false;
    }
    return this.rejected;
  }

  reset() {
    this.candidateFrames = 0;
    this.clearFrames = 0;
    this.candidateMs = 0;
    this.clearMs = 0;
    this.lastTimestamp = null;
    this.rejected = false;
  }
}
