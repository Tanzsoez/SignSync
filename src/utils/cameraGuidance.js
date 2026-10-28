const SAFE_BOUNDS = Object.freeze({ left: 0.12, top: 0.12, right: 0.88, bottom: 0.9 });

export function getHandPositionGuidance(handLandmarks = []) {
  const points = handLandmarks.filter(Boolean).flat();
  if (!points.length) return { level: 'waiting', message: 'Place your hand inside the guide' };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const width = right - left;
  const height = bottom - top;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  if (width < 0.16 && height < 0.24) return { level: 'adjust', message: 'Move your hands closer to the camera' };
  if (width > 0.82 || height > 0.86) return { level: 'adjust', message: 'Move slightly farther from the camera' };
  if (centerX < SAFE_BOUNDS.left || centerX > SAFE_BOUNDS.right) return { level: 'adjust', message: 'Move your hands toward the center' };
  if (centerY < SAFE_BOUNDS.top) return { level: 'adjust', message: 'Lower your hands into the guide' };
  if (centerY > SAFE_BOUNDS.bottom) return { level: 'adjust', message: 'Raise your hands into the guide' };
  if (left < 0.02 || right > 0.98 || top < 0.02 || bottom > 0.98) return { level: 'adjust', message: 'Keep your entire hand visible' };
  return { level: 'ready', message: 'Hand position looks good' };
}

export function drawCameraGuide(ctx) {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.46)';
  ctx.lineWidth = Math.max(2, width / 360);
  ctx.setLineDash([Math.max(8, width / 55), Math.max(6, width / 75)]);
  ctx.beginPath();
  const x = SAFE_BOUNDS.left * width;
  const y = SAFE_BOUNDS.top * height;
  const guideWidth = (SAFE_BOUNDS.right - SAFE_BOUNDS.left) * width;
  const guideHeight = (SAFE_BOUNDS.bottom - SAFE_BOUNDS.top) * height;
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, guideWidth, guideHeight, Math.min(width, height) * 0.035);
  } else {
    ctx.rect(x, y, guideWidth, guideHeight);
  }
  ctx.stroke();
  ctx.restore();
}
