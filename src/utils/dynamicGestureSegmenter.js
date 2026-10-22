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
  nominalFrameMs: 1000 / 30,
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
    const frameMs = this.config.nominalFrameMs;
    this.timing = {
      preRollMs: options.preRollMs ?? this.config.preRollFrames * frameMs,
      minimumGestureMs: options.minimumGestureMs ?? this.config.minimumGestureFrames * frameMs,
      maximumGestureMs: options.maximumGestureMs ?? this.config.maximumGestureFrames * frameMs,
      startMotionMs: options.startMotionMs ?? this.config.startMotionFrames * frameMs,
      endQuietMs: options.endQuietMs ?? this.config.endQuietFrames * frameMs,
      stableFallbackMs: options.stableFallbackMs ?? this.config.stableFallbackFrames * frameMs,
      exitStableMs: options.exitStableMs ?? 12 * frameMs,
    };
    this.reset();
  }

  reset() {
    this.state = 'armed';
    this.previousFrame = null;
    this.previousTimestamp = null;
    this.preRoll = [];
    this.armedFrames = [];
    this.gestureFrames = [];
    this.motionStreak = 0;
    this.quietStreak = 0;
    this.peakMotion = 0;
  }

  snapshot() {
    const source = this.state === 'recording' ? this.gestureFrames : this.armedFrames;
    return {
      state: this.state,
      frameCount: source.length,
      durationMs: Math.round(this.durationOf(source)),
      peakMotion: this.peakMotion,
    };
  }

  durationOf(records) {
    if (!records.length) return 0;
    return records[records.length - 1].timestamp - records[0].timestamp + this.config.nominalFrameMs;
  }

  resolveTimestamp(timestamp) {
    if (Number.isFinite(timestamp)) {
      return this.previousTimestamp == null ? timestamp : Math.max(timestamp, this.previousTimestamp + 1);
    }
    return (this.previousTimestamp ?? 0) + this.config.nominalFrameMs;
  }

  trimBefore(records, cutoff) {
    while (records.length > 1 && records[0].timestamp < cutoff) records.shift();
  }

  push(rawFrame, timestamp) {
    if (!rawFrame || rawFrame.length !== this.config.featureCount) return null;
    const frame = Float32Array.from(rawFrame);
    const frameTimestamp = this.resolveTimestamp(timestamp);
    const elapsedMs = this.previousTimestamp == null
      ? this.config.nominalFrameMs
      : Math.max(1, frameTimestamp - this.previousTimestamp);
    const rawMotion = dynamicFrameMotion(this.previousFrame, frame);
    const cadenceScale = Math.min(2.5, Math.max(0.35, this.config.nominalFrameMs / elapsedMs));
    const motion = rawMotion * cadenceScale;
    this.previousFrame = frame;
    this.previousTimestamp = frameTimestamp;
    this.peakMotion = Math.max(this.peakMotion, motion);
    const record = { frame, timestamp: frameTimestamp };

    if (this.state === 'armed') {
      this.preRoll.push(record);
      this.trimBefore(this.preRoll, frameTimestamp - this.timing.preRollMs);
      this.armedFrames.push(record);
      this.trimBefore(this.armedFrames, frameTimestamp - this.timing.stableFallbackMs);

      this.motionStreak = motion >= this.config.startMotionThreshold
        ? this.motionStreak + elapsedMs
        : 0;
      if (this.motionStreak + 0.5 >= this.timing.startMotionMs) {
        this.state = 'recording';
        this.gestureFrames = this.preRoll.map((item) => ({
          frame: Float32Array.from(item.frame), timestamp: item.timestamp,
        }));
        this.quietStreak = 0;
        return { type: 'started', motion, ...this.snapshot() };
      }

      // Some conversational labels are intentionally pose-like (for example
      // I LOVE YOU). Give them a completion path without fabricating motion.
      if (this.durationOf(this.armedFrames) + 0.5 >= this.timing.stableFallbackMs) {
        return this.complete('stable-hold');
      }
      return { type: 'tracking', motion, ...this.snapshot() };
    }

    this.gestureFrames.push(record);
    this.quietStreak = motion <= this.config.endMotionThreshold
      ? this.quietStreak + elapsedMs
      : 0;

    if (
      this.durationOf(this.gestureFrames) + 0.5 >= this.timing.minimumGestureMs &&
      this.quietStreak + 0.5 >= this.timing.endQuietMs
    ) {
      return this.complete('motion-ended');
    }
    if (this.durationOf(this.gestureFrames) + 0.5 >= this.timing.maximumGestureMs) {
      return this.complete('maximum-window');
    }
    return { type: 'recording', motion, ...this.snapshot() };
  }

  finish() {
    if (this.state === 'recording' && this.durationOf(this.gestureFrames) + 0.5 >= this.timing.minimumGestureMs) {
      return this.complete('hand-exit');
    }
    if (this.state === 'armed' && this.durationOf(this.armedFrames) + 0.5 >= this.timing.exitStableMs) {
      return this.complete('hand-exit-stable');
    }
    this.reset();
    return null;
  }

  complete(reason) {
    const source = this.state === 'recording' ? this.gestureFrames : this.armedFrames;
    const frames = source.map((item) => Float32Array.from(item.frame));
    const timestamps = source.map((item) => item.timestamp);
    const event = {
      type: 'completed',
      reason,
      frames,
      timestamps,
      frameCount: frames.length,
      durationMs: Math.round(this.durationOf(source)),
      peakMotion: this.peakMotion,
    };
    this.reset();
    return event;
  }
}
