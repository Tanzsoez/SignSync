const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function scheduleVideoFrame(video, callback) {
  if (video?.requestVideoFrameCallback) {
    return { kind: 'video', id: video.requestVideoFrameCallback(callback) };
  }
  return { kind: 'animation', id: requestAnimationFrame(callback) };
}

export function cancelVideoFrame(video, handle) {
  if (!handle) return;
  if (handle.kind === 'video' && video?.cancelVideoFrameCallback) {
    video.cancelVideoFrameCallback(handle.id);
  } else {
    cancelAnimationFrame(handle.id ?? handle);
  }
}

/**
 * Adjusts the submission cadence from measured MediaPipe latency. Browser
 * hardware hints are incomplete on iOS, so observed latency is the authority.
 */
export class AdaptiveInferenceController {
  constructor(profile) {
    this.profile = profile;
    this.emaLatencyMs = 0;
    this.samples = 0;
  }

  recordLatency(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 5000) return;
    this.emaLatencyMs = this.samples === 0
      ? durationMs
      : this.emaLatencyMs * 0.82 + durationMs * 0.18;
    this.samples += 1;
  }

  get inferenceIntervalMs() {
    if (this.samples < 4) return this.profile.inferenceIntervalMs;
    const maximum = this.profile.mobile ? 250 : 100;
    return Math.round(clamp(
      Math.max(this.profile.inferenceIntervalMs, this.emaLatencyMs * 1.12),
      this.profile.inferenceIntervalMs,
      maximum,
    ));
  }

  get freshnessBudgetMs() {
    if (this.samples < 2) return 700;
    return Math.round(clamp(this.emaLatencyMs * 2.5, 700, 1400));
  }

  snapshot() {
    return {
      inferenceLatencyMs: Math.round(this.emaLatencyMs || 0),
      inferenceIntervalMs: this.inferenceIntervalMs,
      freshnessBudgetMs: this.freshnessBudgetMs,
      samples: this.samples,
    };
  }
}

export class RuntimeDiagnostics {
  constructor(name, profile) {
    this.name = name;
    this.profile = profile;
    this.startedAt = performance.now();
    this.displayFrames = 0;
    this.landmarkFrames = 0;
    this.droppedSubmissions = 0;
    this.lastLandmarkAt = 0;
    this.inferenceLatencyMs = 0;
    this.modelLatencyMs = 0;
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.predictionCount = 0;
    this.acceptedPredictions = 0;
    this.lastPrediction = 'none';
    this.lastConfidence = 0;
  }

  recordDisplay() { this.displayFrames += 1; }
  recordLandmarks(timestamp = performance.now()) {
    this.landmarkFrames += 1;
    this.lastLandmarkAt = timestamp;
  }
  recordDroppedSubmission() { this.droppedSubmissions += 1; }
  recordHolisticLatency(value) { this.inferenceLatencyMs = value; }
  recordModelLatency(value) { this.modelLatencyMs = value; }
  recordVideo(video) {
    this.videoWidth = Number(video?.videoWidth || 0);
    this.videoHeight = Number(video?.videoHeight || 0);
  }
  recordPrediction(prediction, mode) {
    this.predictionCount += 1;
    if (prediction) {
      this.acceptedPredictions += 1;
      this.lastPrediction = `${mode}:${prediction.label || prediction.sign || 'accepted'}`;
      this.lastConfidence = Math.round(prediction.score || 0);
    } else {
      this.lastPrediction = `${mode}:rejected`;
      this.lastConfidence = 0;
    }
  }

  snapshot(now = performance.now()) {
    const elapsedSeconds = Math.max(1, (now - this.startedAt) / 1000);
    return {
      source: this.name,
      profile: this.profile.tier,
      mobile: this.profile.mobile,
      displayFps: Number((this.displayFrames / elapsedSeconds).toFixed(1)),
      landmarkFps: Number((this.landmarkFrames / elapsedSeconds).toFixed(1)),
      landmarkAgeMs: this.lastLandmarkAt ? Math.round(now - this.lastLandmarkAt) : null,
      holisticLatencyMs: Math.round(this.inferenceLatencyMs || 0),
      modelLatencyMs: Math.round(this.modelLatencyMs || 0),
      camera: this.videoWidth ? `${this.videoWidth}x${this.videoHeight}` : 'pending',
      lastPrediction: this.lastPrediction,
      confidence: this.lastConfidence,
      acceptedRate: this.predictionCount
        ? Number((this.acceptedPredictions / this.predictionCount).toFixed(2))
        : 0,
      droppedSubmissions: this.droppedSubmissions,
    };
  }

  publish(adaptiveController) {
    if (typeof window === 'undefined') return;
    const detail = { ...this.snapshot(), ...adaptiveController?.snapshot() };
    window.__SIGNSYNC_DIAGNOSTICS__ = detail;
    window.dispatchEvent(new CustomEvent('signsync:diagnostics', { detail }));
    if (new URLSearchParams(window.location.search).has('diagnostics')) {
      console.debug('[SignSync diagnostics]', detail);
    }
  }
}
