const DEFAULTS = Object.freeze({
  featureCount: 168,
  preRollFrames: 6,
  minimumGestureFrames: 18,
  maximumGestureFrames: 60,
  startMotionThreshold: 0.024,
  endMotionThreshold: 0.018,
  startMotionFrames: 2,
  endQuietFrames: 7,
  stableFallbackFrames: 42,
});

// Features that retain useful handshape and body-relative motion. Presence
// flags are deliberately excluded because a tracking flicker is not a sign.
const MOTION_INDICES = Object.freeze([
  ...Array.from({ length: 60 }, (_, index) => index),
  ...Array.from({ length: 60 }, (_, index) => index + 72),
  ...Array.from({ length: 12 }, (_, index) => index + 144),
  ...Array.from({ length: 10 }, (_, index) => index + 158),
]);

export function dynamicFrameMotion(previous, current) {
  if (!previous || !current || previous.length !== current.length) return 0;
  let squared = 0;
  for (const index of MOTION_INDICES) {
    const delta = Number(current[index] || 0) - Number(previous[index] || 0);
    squared += delta * delta;
  }
  return Math.sqrt(squared / MOTION_INDICES.length);
}

export class DynamicGestureSegmenter {
  constructor(options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.reset();
  }

  reset() {
    this.state = 'armed';
    this.previousFrame = null;
    this.preRoll = [];
    this.armedFrames = [];
    this.gestureFrames = [];
    this.motionStreak = 0;
    this.quietStreak = 0;
    this.peakMotion = 0;
  }

  snapshot() {
    return {
      state: this.state,
      frameCount: this.state === 'recording' ? this.gestureFrames.length : this.armedFrames.length,
      peakMotion: this.peakMotion,
    };
  }

  push(rawFrame) {
    if (!rawFrame || rawFrame.length !== this.config.featureCount) return null;
    const frame = Float32Array.from(rawFrame);
    const motion = dynamicFrameMotion(this.previousFrame, frame);
    this.previousFrame = frame;
    this.peakMotion = Math.max(this.peakMotion, motion);

    if (this.state === 'armed') {
      this.preRoll.push(frame);
      if (this.preRoll.length > this.config.preRollFrames) this.preRoll.shift();
      this.armedFrames.push(frame);
      if (this.armedFrames.length > this.config.stableFallbackFrames) this.armedFrames.shift();

      this.motionStreak = motion >= this.config.startMotionThreshold
        ? this.motionStreak + 1
        : 0;
      if (this.motionStreak >= this.config.startMotionFrames) {
        this.state = 'recording';
        this.gestureFrames = this.preRoll.map((item) => Float32Array.from(item));
        this.quietStreak = 0;
        return { type: 'started', motion, ...this.snapshot() };
      }

      // Some conversational labels are intentionally pose-like (for example
      // I LOVE YOU). Give them a completion path without fabricating motion.
      if (this.armedFrames.length >= this.config.stableFallbackFrames) {
        return this.complete('stable-hold');
      }
      return { type: 'tracking', motion, ...this.snapshot() };
    }

    this.gestureFrames.push(frame);
    this.quietStreak = motion <= this.config.endMotionThreshold
      ? this.quietStreak + 1
      : 0;

    if (
      this.gestureFrames.length >= this.config.minimumGestureFrames &&
      this.quietStreak >= this.config.endQuietFrames
    ) {
      return this.complete('motion-ended');
    }
    if (this.gestureFrames.length >= this.config.maximumGestureFrames) {
      return this.complete('maximum-window');
    }
    return { type: 'recording', motion, ...this.snapshot() };
  }

  finish() {
    if (this.state === 'recording' && this.gestureFrames.length >= this.config.minimumGestureFrames) {
      return this.complete('hand-exit');
    }
    if (this.state === 'armed' && this.armedFrames.length >= 12) {
      return this.complete('hand-exit-stable');
    }
    this.reset();
    return null;
  }

  complete(reason) {
    const source = this.state === 'recording' ? this.gestureFrames : this.armedFrames;
    const frames = source.map((frame) => Float32Array.from(frame));
    const event = {
      type: 'completed',
      reason,
      frames,
      frameCount: frames.length,
      peakMotion: this.peakMotion,
    };
    this.reset();
    return event;
  }
}
