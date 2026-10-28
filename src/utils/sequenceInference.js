export const SEQUENCE_LENGTH = 60;
export const SEQUENCE_FEATURES = 168;

const DYNAMIC_CONFUSION_GROUPS = Object.freeze([
  ['ASL_GOOD', 'ASL_THANK_YOU'],
  ['ASL_HELLO', 'ASL_HI'],
  ['ASL_MORNING', 'ASL_AFTERNOON'],
  ['FSL_MAHAL_KITA', 'FSL_MAGANDANG_HAPON', 'FSL_MAGANDANG_GABI'],
  ['FSL_PATAWAD', 'FSL_MAY_SAKIT_AKO'],
]);

export function mirrorStaticFeatures(features) {
  if (!features || features.length !== 72) return null;
  const mirrored = Float32Array.from(features);
  for (let index = 0; index < 60; index += 3) mirrored[index] *= -1;
  return mirrored;
}

// Mirrors body-relative-two-hand-v2/168 exactly as the training augmenter does:
// anatomical right/left channels are exchanged and camera-space X coordinates
// are inverted. Applying this function twice returns the original frame.
export function mirrorDynamicFrame(features) {
  if (!features || features.length !== SEQUENCE_FEATURES) return null;
  const source = features;
  const mirrored = Float32Array.from(source);
  mirrored.set(source.slice(72, 144), 0);
  mirrored.set(source.slice(0, 72), 72);
  for (let index = 0; index < 60; index += 3) mirrored[index] *= -1;
  for (let index = 72; index < 132; index += 3) mirrored[index] *= -1;
  mirrored.set(source.slice(147, 150), 144);
  mirrored.set(source.slice(144, 147), 147);
  mirrored.set(source.slice(153, 156), 150);
  mirrored.set(source.slice(150, 153), 153);
  for (const index of [144, 147, 150, 153]) mirrored[index] *= -1;
  mirrored[156] = source[157];
  mirrored[157] = source[156];
  mirrored.set(source.slice(161, 164), 158);
  mirrored.set(source.slice(158, 161), 161);
  mirrored[164] = source[164];
  mirrored[165] = -source[165];
  mirrored[166] = -source[166];
  mirrored[167] = source[167];
  return mirrored;
}

function normalizeValues(values, normalization, featureCount) {
  const mean = normalization?.mean;
  const std = normalization?.std;
  const clip = Number(normalization?.clip || 8);
  if (!mean || !std || mean.length !== featureCount || std.length !== featureCount) return null;
  return Float32Array.from(values, (value, index) => {
    const feature = index % featureCount;
    return Math.max(-clip, Math.min(clip, (value - mean[feature]) / (std[feature] || 1)));
  });
}

function averageRows(values, rowCount, columns) {
  const averaged = new Float32Array(columns);
  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      averaged[column] += values[row * columns + column] / rowCount;
    }
  }
  return averaged;
}

export function resampleTimedFrames(frames, timestamps, targetLength = SEQUENCE_LENGTH) {
  if (!frames?.length || targetLength < 1) return [];
  if (!timestamps || timestamps.length !== frames.length || frames.length === 1) {
    return Array.from({ length: targetLength }, (_, target) => {
      const position = frames.length === 1 ? 0 : (target * (frames.length - 1)) / (targetLength - 1 || 1);
      const low = Math.floor(position);
      const high = Math.min(frames.length - 1, low + 1);
      const blend = position - low;
      return Float32Array.from(frames[low], (value, feature) => (
        value * (1 - blend) + frames[high][feature] * blend
      ));
    });
  }

  const start = timestamps[0];
  const end = Math.max(start + 1, timestamps[timestamps.length - 1]);
  let high = 1;
  return Array.from({ length: targetLength }, (_, target) => {
    const targetTime = start + ((end - start) * target) / (targetLength - 1 || 1);
    while (high < timestamps.length - 1 && timestamps[high] < targetTime) high += 1;
    const low = Math.max(0, high - 1);
    const span = Math.max(1, timestamps[high] - timestamps[low]);
    const blend = Math.min(1, Math.max(0, (targetTime - timestamps[low]) / span));
    return Float32Array.from(frames[low], (value, feature) => (
      value * (1 - blend) + frames[high][feature] * blend
    ));
  });
}

export class SequenceRingBuffer {
  constructor(capacity = SEQUENCE_LENGTH, featureCount = SEQUENCE_FEATURES) {
    this.capacity = capacity;
    this.featureCount = featureCount;
    this.storage = new Float32Array(capacity * featureCount);
    this.chronological = new Float32Array(capacity * featureCount);
    this.normalized = new Float32Array(capacity * featureCount);
    this.writeIndex = 0;
    this.count = 0;
  }

  clear() {
    this.writeIndex = 0;
    this.count = 0;
  }

  push(frame) {
    if (!frame || frame.length !== this.featureCount) return false;
    this.storage.set(frame, this.writeIndex * this.featureCount);
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
    return true;
  }

  toNormalizedInput(normalization) {
    if (this.count === 0) return null;
    const oldestIndex = (this.writeIndex - this.count + this.capacity) % this.capacity;
    const padCount = this.capacity - this.count;
    const firstOffset = oldestIndex * this.featureCount;

    for (let frameIndex = 0; frameIndex < padCount; frameIndex += 1) {
      this.chronological.set(
        this.storage.subarray(firstOffset, firstOffset + this.featureCount),
        frameIndex * this.featureCount
      );
    }
    for (let frameIndex = 0; frameIndex < this.count; frameIndex += 1) {
      const sourceIndex = (oldestIndex + frameIndex) % this.capacity;
      const sourceOffset = sourceIndex * this.featureCount;
      this.chronological.set(
        this.storage.subarray(sourceOffset, sourceOffset + this.featureCount),
        (padCount + frameIndex) * this.featureCount
      );
    }

    const mean = normalization?.mean;
    const std = normalization?.std;
    const clip = Number(normalization?.clip || 8);
    if (!mean || !std || mean.length !== this.featureCount || std.length !== this.featureCount) {
      return null;
    }
    for (let frameIndex = 0; frameIndex < this.capacity; frameIndex += 1) {
      const offset = frameIndex * this.featureCount;
      for (let featureIndex = 0; featureIndex < this.featureCount; featureIndex += 1) {
        const divisor = std[featureIndex] || 1;
        const value = (this.chronological[offset + featureIndex] - mean[featureIndex]) / divisor;
        this.normalized[offset + featureIndex] = Math.max(-clip, Math.min(clip, value));
      }
    }
    return this.normalized;
  }

  toResampledNormalizedInput(normalization) {
    const raw = this.toResampledInput();
    if (!raw) return null;
    return this.normalizeChronological(normalization);
  }

  toResampledInput() {
    if (this.count === 0) return null;
    const oldestIndex = (this.writeIndex - this.count + this.capacity) % this.capacity;
    for (let target = 0; target < this.capacity; target += 1) {
      const position = this.count === 1 ? 0 : (target * (this.count - 1)) / (this.capacity - 1);
      const low = Math.floor(position);
      const high = Math.min(this.count - 1, low + 1);
      const blend = position - low;
      const lowOffset = ((oldestIndex + low) % this.capacity) * this.featureCount;
      const highOffset = ((oldestIndex + high) % this.capacity) * this.featureCount;
      const targetOffset = target * this.featureCount;
      for (let feature = 0; feature < this.featureCount; feature += 1) {
        this.chronological[targetOffset + feature] =
          this.storage[lowOffset + feature] * (1 - blend) +
          this.storage[highOffset + feature] * blend;
      }
    }
    return this.chronological;
  }

  normalizeChronological(normalization) {
    const mean = normalization?.mean;
    const std = normalization?.std;
    const clip = Number(normalization?.clip || 8);
    if (!mean || !std || mean.length !== this.featureCount || std.length !== this.featureCount) {
      return null;
    }
    for (let index = 0; index < this.chronological.length; index += 1) {
      const feature = index % this.featureCount;
      const value = (this.chronological[index] - mean[feature]) / (std[feature] || 1);
      this.normalized[index] = Math.max(-clip, Math.min(clip, value));
    }
    return this.normalized;
  }
}

function rankedDialectProbabilities(logits, labels, dialect) {
  const prefix = dialect?.toUpperCase() === 'FSL' ? 'FSL_' : 'ASL_';
  const allowed = labels
    .map((label, index) => ({ label, index }))
    .filter(({ label }) => label.startsWith(prefix));
  if (!allowed.length) return [];
  const maxLogit = Math.max(...allowed.map(({ index }) => logits[index]));
  const probabilities = allowed.map(({ label, index }) => ({
    label,
    probability: Math.exp(logits[index] - maxLogit),
  }));
  const sum = probabilities.reduce((total, item) => total + item.probability, 0) || 1;
  probabilities.forEach((item) => { item.probability /= sum; });
  return probabilities.sort((left, right) => right.probability - left.probability);
}

const pointFromShape = (sequence, frameOffset, shapeOffset, landmark) => {
  if (landmark === 0) return [0, 0, 0];
  const offset = frameOffset + shapeOffset + (landmark - 1) * 3;
  return [sequence[offset], sequence[offset + 1], sequence[offset + 2]];
};

const vectorLength = (point) => Math.hypot(point[0], point[1], point[2]);

/**
 * Hand-independent biomechanical summary used only for known close phrase
 * pairs. Extension ratios are wrist/palm-relative, so camera position, arm
 * crop, distance, and signing side do not change them.
 */
export function summarizeDynamicHandshape(sequence) {
  if (!sequence || sequence.length % SEQUENCE_FEATURES !== 0) return null;
  const sums = new Float64Array(5);
  let visibleSamples = 0;
  let ilyLikeSamples = 0;
  let bothHandFrames = 0;
  const verticalHandOffsets = [];
  const sideSums = [new Float64Array(5), new Float64Array(5)];
  const sideCounts = [0, 0];
  const frameCount = sequence.length / SEQUENCE_FEATURES;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const frameOffset = frame * SEQUENCE_FEATURES;
    const hasRight = sequence[frameOffset + 156] > 0.5;
    const hasLeft = sequence[frameOffset + 157] > 0.5;
    if (hasRight && hasLeft) {
      bothHandFrames += 1;
      verticalHandOffsets.push(Math.abs(sequence[frameOffset + 165]));
    }
    for (const [side, shapeOffset, presenceOffset] of [[0, 0, 156], [1, 72, 157]]) {
      if (sequence[frameOffset + presenceOffset] <= 0.5) continue;
      const palmScale = Math.max(
        0.04,
        vectorLength(pointFromShape(sequence, frameOffset, shapeOffset, 9)),
      );
      const ratios = [4, 8, 12, 16, 20].map((landmark) => (
        vectorLength(pointFromShape(sequence, frameOffset, shapeOffset, landmark)) / palmScale
      ));
      if (!ratios.every(Number.isFinite)) continue;
      ratios.forEach((ratio, index) => {
        sums[index] += ratio;
        sideSums[side][index] += ratio;
      });
      sideCounts[side] += 1;
      visibleSamples += 1;
      const [, index, middle, ring, pinky] = ratios;
      if (index > 1.45 && pinky > 1.30 && middle < 1.15 && ring < 1.15) {
        ilyLikeSamples += 1;
      }
    }
  }
  if (visibleSamples < 8) return null;
  verticalHandOffsets.sort((left, right) => left - right);
  const middleOffset = Math.floor(verticalHandOffsets.length / 2);
  const medianVerticalHandOffset = verticalHandOffsets.length === 0
    ? 0
    : verticalHandOffsets.length % 2
      ? verticalHandOffsets[middleOffset]
      : (verticalHandOffsets[middleOffset - 1] + verticalHandOffsets[middleOffset]) / 2;
  const sideExtensionMeans = sideSums.flatMap((sideSum, side) => (
    sideCounts[side]
      ? [[...sideSum].map((sum) => sum / sideCounts[side])]
      : []
  ));
  return {
    extensionMean: [...sums].map((sum) => sum / visibleSamples),
    ilyLikeRatio: ilyLikeSamples / visibleSamples,
    visibleSamples,
    bothHandsRatio: bothHandFrames / frameCount,
    medianVerticalHandOffset,
    sideExtensionMeans,
  };
}

function promoteProbability(probabilities, label, minimumProbability) {
  const promoted = probabilities.map((item) => ({ ...item }));
  const target = promoted.find((item) => item.label === label);
  if (!target || target.probability >= minimumProbability) {
    return promoted.sort((left, right) => right.probability - left.probability);
  }
  const previous = target.probability;
  const otherTotal = Math.max(1e-9, 1 - previous);
  const remaining = 1 - minimumProbability;
  for (const item of promoted) {
    item.probability = item === target
      ? minimumProbability
      : item.probability * remaining / otherTotal;
  }
  return promoted.sort((left, right) => right.probability - left.probability);
}

export function resolveDynamicConfusions(probabilities, sequence, dialect) {
  const ranked = probabilities.map((item) => ({ ...item }));
  const top = ranked[0]?.label;
  const physical = summarizeDynamicHandshape(sequence);
  if (!top || !physical) return { probabilities: ranked, reason: null, physical };
  const [thumb, index, middle, ring, pinky] = physical.extensionMean;
  const probabilityFor = (label) => ranked.find((item) => item.label === label)?.probability || 0;

  const thankYouHandshape = (
    thumb < 1.65 && index < 2.10 && middle < 2.14 && ring < 1.98
  );
  const receivingHandEvidence = (
    physical.bothHandsRatio >= 0.60 && physical.medianVerticalHandOffset >= 0.145
  );
  const thankYouFallback = (
    physical.bothHandsRatio < 0.55 || probabilityFor('ASL_THANK_YOU') >= 0.02
  );
  if (
    dialect?.toUpperCase() !== 'FSL' && top === 'ASL_GOOD' &&
    (thankYouHandshape || (!receivingHandEvidence && thankYouFallback))
  ) {
    return {
      probabilities: promoteProbability(ranked, 'ASL_THANK_YOU', 0.76),
      reason: 'compact flat-hand profile confirms Thank You',
      physical,
    };
  }

  if (
    dialect?.toUpperCase() === 'FSL' && top === 'FSL_MAGANDANG_HAPON' &&
    physical.ilyLikeRatio >= 0.60
  ) {
    return {
      probabilities: promoteProbability(ranked, 'FSL_MAHAL_KITA', 0.78),
      reason: 'ILY handshape confirms Mahal Kita',
      physical,
    };
  }

  const gabiHandshape = thumb > 1.58 || (index > 1.38 && middle > 1.22);
  if (
    dialect?.toUpperCase() === 'FSL' && top === 'FSL_MAGANDANG_HAPON' &&
    physical.ilyLikeRatio < 0.20 && gabiHandshape
  ) {
    return {
      probabilities: promoteProbability(ranked, 'FSL_MAGANDANG_GABI', 0.72),
      reason: 'curved/open handshape confirms Magandang Gabi',
      physical,
    };
  }

  const afternoonHandshape = middle > 1.54 && ring > 1.49 && pinky > 1.36;
  if (
    dialect?.toUpperCase() !== 'FSL' && top === 'ASL_MORNING' && afternoonHandshape
    && probabilityFor('ASL_AFTERNOON') >= 0.03
  ) {
    return {
      probabilities: promoteProbability(ranked, 'ASL_AFTERNOON', 0.70),
      reason: 'flat extended handshape confirms Good Afternoon',
      physical,
    };
  }

  return { probabilities: ranked, reason: null, physical };
}

function acceptedPrediction(probabilities, metadata, engine, isDynamic, started, refinementReason = null) {
  const best = probabilities[0];
  if (!best) return null;
  const second = probabilities[1]?.probability || 0;
  const margin = best.probability - second;
  const confidenceThreshold = Number(metadata.thresholds?.confidence || (isDynamic ? 0.45 : 0.48));
  let marginThreshold = Number(metadata.thresholds?.margin || (isDynamic ? 0.06 : 0.08));
  const secondLabel = probabilities[1]?.label;
  const isKnownConfusion = isDynamic && !refinementReason && DYNAMIC_CONFUSION_GROUPS.some((group) => (
    group.includes(best.label) && group.includes(secondLabel)
  ));
  if (isKnownConfusion) marginThreshold = Math.max(marginThreshold, 0.14);
  if (best.probability < confidenceThreshold || margin < marginThreshold) return null;
  return {
    sign: best.label.replace(/^(ASL_|FSL_)/, ''),
    label: best.label,
    score: Math.min(99, Math.round(best.probability * 100)),
    confidence: best.probability,
    margin,
    topPredictions: probabilities.slice(0, 3),
    isDynamic,
    engine,
    refinementReason,
    latencyMs: performance.now() - started,
  };
}

export async function predictStatic({ tf, model, metadata, features, dialect }) {
  if (!model || !metadata || !features || features.length !== 72) return null;
  const mean = metadata.normalization?.mean;
  const std = metadata.normalization?.std;
  if (!mean || !std || mean.length !== 72 || std.length !== 72) return null;
  const mirrored = mirrorStaticFeatures(features);
  const normalized = normalizeValues(features, metadata.normalization, 72);
  const normalizedMirrored = normalizeValues(mirrored, metadata.normalization, 72);
  if (!normalized || !normalizedMirrored) return null;
  const batch = new Float32Array(144);
  batch.set(normalized, 0);
  batch.set(normalizedMirrored, 72);
  const started = performance.now();
  const output = tf.tidy(() => model.predict(tf.tensor(batch, [2, 72], 'float32')));
  let logits;
  try {
    const rawLogits = await output.data();
    logits = averageRows(rawLogits, 2, metadata.labels.length);
  } finally { output.dispose(); }
  return acceptedPrediction(
    rankedDialectProbabilities(logits, metadata.labels, dialect),
    metadata, 'STATIC_MLP', false, started
  );
}

export async function predictDynamicSequence({ tf, model, metadata, ringBuffer, dialect }) {
  if (!model || !metadata || !ringBuffer) return null;
  const raw = ringBuffer.toResampledInput();
  if (!raw) return null;
  const mirroredRaw = new Float32Array(raw.length);
  for (let frame = 0; frame < SEQUENCE_LENGTH; frame += 1) {
    const offset = frame * SEQUENCE_FEATURES;
    mirroredRaw.set(mirrorDynamicFrame(raw.subarray(offset, offset + SEQUENCE_FEATURES)), offset);
  }
  const normalized = normalizeValues(raw, metadata.normalization, SEQUENCE_FEATURES);
  const normalizedMirrored = normalizeValues(mirroredRaw, metadata.normalization, SEQUENCE_FEATURES);
  if (!normalized || !normalizedMirrored) return null;
  const batch = new Float32Array(normalized.length * 2);
  batch.set(normalized, 0);
  batch.set(normalizedMirrored, normalized.length);
  const started = performance.now();
  const output = tf.tidy(() => model.predict(tf.tensor(batch, [2, 60, 168], 'float32')));
  let logits;
  try {
    const rawLogits = await output.data();
    logits = averageRows(rawLogits, 2, metadata.labels.length);
  } finally { output.dispose(); }
  const ranked = rankedDialectProbabilities(logits, metadata.labels, dialect);
  const refined = resolveDynamicConfusions(ranked, raw, dialect);
  return acceptedPrediction(
    refined.probabilities,
    metadata, 'DYNAMIC_GRU', true, started, refined.reason
  );
}
