export function getRuntimeProfile() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      compact: false,
      lowPower: false,
      cameraWidth: 640,
      cameraHeight: 480,
      inferenceIntervalMs: 34,
      displayIntervalMs: 16,
      maxPixelRatio: 2,
    };
  }

  const compact = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const cores = Number(navigator.hardwareConcurrency || 8);
  const memory = Number(navigator.deviceMemory || 8);
  const lowPower = cores <= 4 || memory <= 4;

  return {
    compact,
    lowPower,
    cameraWidth: lowPower ? 480 : 640,
    cameraHeight: lowPower ? 360 : 480,
    inferenceIntervalMs: lowPower ? 66 : compact ? 50 : 34,
    displayIntervalMs: lowPower ? 42 : compact ? 32 : 16,
    maxPixelRatio: lowPower ? 1 : compact ? 1.35 : 2,
  };
}

export function cameraConstraints(profile = getRuntimeProfile()) {
  return {
    width: { ideal: profile.cameraWidth },
    height: { ideal: profile.cameraHeight },
    frameRate: { ideal: profile.lowPower ? 20 : 30, max: 30 },
    facingMode: 'user',
  };
}
