export const dist3D = (first, second) => Math.hypot(
  first.x - second.x,
  first.y - second.y,
  (first.z || 0) - (second.z || 0),
);

/** Matches the recorder and static-model training feature schema exactly. */
export function extractFeatures72(points) {
  if (!points || points.length < 21) return null;
  const wrist = points[0];
  const palmScale = dist3D(wrist, points[9]);
  if (!Number.isFinite(palmScale) || palmScale < 0.018) return null;
  const rounded = (value) => Number(value.toFixed(4));
  const features = [];
  for (let index = 1; index <= 20; index += 1) {
    features.push(
      rounded((points[index].x - wrist.x) / palmScale),
      rounded((points[index].y - wrist.y) / palmScale),
      rounded(((points[index].z || 0) - (wrist.z || 0)) / palmScale),
    );
  }
  features.push(
    ...[[4, 8], [4, 12], [4, 16], [4, 20], [8, 12], [12, 16],
      [16, 20], [4, 5], [4, 6], [4, 10], [4, 14], [4, 18]]
      .map(([first, second]) => rounded(dist3D(points[first], points[second]) / palmScale)),
  );
  return features.length === 72 && features.every(Number.isFinite) ? features : null;
}
