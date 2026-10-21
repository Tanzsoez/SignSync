const TRACE_CYCLE_SECONDS = 2.8;
const RECORDED_PREPARATION_SECONDS = 0.22;
const RECORDED_HOLD_SECONDS = 0.38;
const RECORDED_RESET_SECONDS = 0.34;

const TRACE_PATHS = {
  J: [[0, -0.12], [0.01, 0.02], [0.015, 0.18], [-0.04, 0.27], [-0.14, 0.3], [-0.21, 0.24]],
  Z: [[-0.17, -0.1], [0.18, -0.1], [-0.17, 0.18], [0.2, 0.18]],
};

const samplePath = (path, progress) => {
  const position = Math.min(1, Math.max(0, progress)) * (path.length - 1);
  const fromIndex = Math.floor(position);
  const toIndex = Math.min(path.length - 1, fromIndex + 1);
  const blend = position - fromIndex;
  return [
    path[fromIndex][0] + (path[toIndex][0] - path[fromIndex][0]) * blend,
    path[fromIndex][1] + (path[toIndex][1] - path[fromIndex][1]) * blend,
  ];
};

export const getRecordedPlaybackProgress = (elapsed, motionDuration = 2) => {
  const motionSeconds = Math.max(0.8, motionDuration);
  const cycleSeconds = RECORDED_PREPARATION_SECONDS + motionSeconds
    + RECORDED_HOLD_SECONDS + RECORDED_RESET_SECONDS;
  const cycleTime = ((elapsed % cycleSeconds) + cycleSeconds) % cycleSeconds;
  if (cycleTime < RECORDED_PREPARATION_SECONDS) return 0;
  if (cycleTime >= RECORDED_PREPARATION_SECONDS + motionSeconds) return 1;
  const linear = (cycleTime - RECORDED_PREPARATION_SECONDS) / motionSeconds;
  return linear * linear * (3 - 2 * linear);
};

export const getLetterMotionOffset = (fullKey, elapsed) => {
  const letter = fullKey.split('_').at(-1);
  const phase = ((elapsed % TRACE_CYCLE_SECONDS) + TRACE_CYCLE_SECONDS) % TRACE_CYCLE_SECONDS / TRACE_CYCLE_SECONDS;

  if (letter === 'Ñ' || letter === 'ENYE') {
    const envelope = phase < 0.78 ? Math.sin((phase / 0.78) * Math.PI) : 0;
    return [Math.sin((phase / 0.78) * Math.PI * 4) * 0.105 * envelope, 0, 0];
  }

  const path = TRACE_PATHS[letter];
  if (!path) return [0, 0, 0];
  if (phase < 0.72) {
    const [x, y] = samplePath(path, phase / 0.72);
    return [x, y, 0];
  }
  if (phase < 0.86) {
    const [x, y] = path.at(-1);
    return [x, y, 0];
  }
  const returnBlend = (phase - 0.86) / 0.14;
  const eased = returnBlend * returnBlend * (3 - 2 * returnBlend);
  const end = path.at(-1);
  const start = path[0];
  return [end[0] + (start[0] - end[0]) * eased, end[1] + (start[1] - end[1]) * eased, 0];
};
