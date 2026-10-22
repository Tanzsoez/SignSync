export function getRuntimeProfile() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      compact: false,
      mobile: false,
      lowPower: false,
      tier: 'desktop',
      cameraWidth: 640,
      cameraHeight: 480,
      inferenceIntervalMs: 34,
      displayIntervalMs: 16,
      maxPixelRatio: 2,
    };
  }

  const compact = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const mobile = compact || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const cores = Number(navigator.hardwareConcurrency || 0) || null;
  const memory = Number(navigator.deviceMemory || 0) || null;
  let preference = 'auto';
  try {
    preference = localStorage.getItem('signsync_performance_mode') || 'auto';
  } catch {
    // Restricted/private storage should not prevent camera initialization.
  }
  const hardwareConstrained = (cores != null && cores <= 4) || (memory != null && memory <= 4);
  const lowPower = preference === 'performance' || (preference !== 'quality' && hardwareConstrained);
  const tier = lowPower ? 'mobile-low' : mobile ? 'mobile-balanced' : 'desktop';

  return {
    compact,
    mobile,
    lowPower,
    tier,
    cameraWidth: lowPower ? 480 : 640,
    cameraHeight: lowPower ? 360 : 480,
    inferenceIntervalMs: lowPower ? 66 : compact ? 50 : 34,
    displayIntervalMs: lowPower ? 42 : compact ? 32 : 16,
    maxPixelRatio: lowPower ? 1 : compact ? 1.35 : 2,
    holisticModelComplexity: preference === 'quality' ? 2 : mobile ? 1 : 2,
    refineFaceLandmarks: false,
    performanceMode: preference,
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
