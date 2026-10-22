import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as tf from '@tensorflow/tfjs';

import {
  mirrorDynamicFrame,
  mirrorStaticFeatures,
  resampleTimedFrames,
  resolveDynamicConfusions,
  SequenceRingBuffer,
  summarizeDynamicHandshape,
} from '../src/utils/sequenceInference.js';
import { DynamicGestureSegmenter, dynamicFrameMotion } from '../src/utils/dynamicGestureSegmenter.js';
import {
  HolisticTrackingStabilizer,
  isFreshHolisticResult,
  selectActiveHandObjects,
} from '../src/utils/holisticTracking.js';
import { DynamicGestureTracker } from '../src/utils/dynamicGestureEngine.js';
import { cameraConstraints, getRuntimeProfile } from '../src/utils/runtimeProfile.js';
import { AdaptiveInferenceController } from '../src/utils/cameraRuntime.js';
import { extractFeatures72 } from '../src/utils/landmarkFeatures.js';
import { getLetterMotionOffset, getRecordedPlaybackProgress } from '../src/utils/avatarMotion.js';
import { GestureRejectionGate, isIsolatedMiddleFingerGesture } from '../src/utils/gestureSafety.js';
import { createSignSequence, findDialectSign, normalizeSignText } from '../src/utils/textToSign.js';
import { DATASET_CATALOG } from '../src/data/signCatalog.js';


async function loadQuantizedModel(modelRoot) {
  const modelJSON = JSON.parse(await readFile(`${modelRoot}/model.json`, 'utf8'));
  const groups = modelJSON.weightsManifest;
  const weightSpecs = groups.flatMap((group) => group.weights);
  assert.ok(weightSpecs.length > 0);
  assert.ok(weightSpecs.every((weight) => weight.quantization?.dtype === 'uint8'));
  const shardBuffers = await Promise.all(
    groups.flatMap((group) => group.paths).map((path) => readFile(`${modelRoot}/${path}`))
  );
  const merged = Buffer.concat(shardBuffers);
  const weightData = merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength);
  return tf.loadLayersModel({
    load: async () => ({
      modelTopology: modelJSON.modelTopology,
      weightSpecs,
      weightData,
      userDefinedMetadata: modelJSON.userDefinedMetadata,
    }),
  });
}


test('SequenceRingBuffer preserves order and resamples partial gestures', () => {
  const buffer = new SequenceRingBuffer(3, 2);
  buffer.push([1, 2]);
  buffer.push([3, 4]);
  const normalization = { mean: [0, 0], std: [1, 1], clip: 8 };
  assert.deepEqual([...buffer.toNormalizedInput(normalization)], [1, 2, 1, 2, 3, 4]);
  assert.deepEqual([...buffer.toResampledNormalizedInput(normalization)], [1, 2, 2, 3, 3, 4]);
  buffer.push([5, 6]);
  buffer.push([7, 8]);
  assert.deepEqual([...buffer.toNormalizedInput(normalization)], [3, 4, 5, 6, 7, 8]);
});


test('dynamic segmenter waits for a completed motion instead of classifying a prefix', () => {
  const segmenter = new DynamicGestureSegmenter();
  const rest = new Float32Array(168);
  for (let index = 0; index < 6; index += 1) segmenter.push(rest);
  const movingOne = new Float32Array(168);
  const movingTwo = new Float32Array(168);
  for (let index = 0; index < 60; index += 1) {
    movingOne[index] = 0.1;
    movingTwo[index] = 0.2;
  }
  assert.ok(dynamicFrameMotion(rest, movingOne) > 0.024);
  assert.equal(segmenter.push(movingOne).type, 'tracking');
  assert.equal(segmenter.push(movingTwo).type, 'started');
  let completed = null;
  for (let index = 0; index < 20 && !completed; index += 1) {
    const event = segmenter.push(movingTwo);
    if (event?.type === 'completed') completed = event;
  }
  assert.equal(completed?.reason, 'motion-ended');
  assert.ok(completed.frames.length >= 18);
});


test('dynamic segmenter completes pose-like phrases after a stable hold', () => {
  const segmenter = new DynamicGestureSegmenter({ stableFallbackFrames: 12 });
  const pose = new Float32Array(168);
  pose[156] = 1;
  let event = null;
  for (let index = 0; index < 12; index += 1) event = segmenter.push(pose);
  assert.equal(event?.type, 'completed');
  assert.equal(event?.reason, 'stable-hold');
  assert.equal(event.frames.length, 12);
});

test('dynamic segmentation duration is stable across mobile and desktop frame rates', () => {
  const runAtCadence = (intervalMs) => {
    const segmenter = new DynamicGestureSegmenter({ stableFallbackMs: 1000 });
    const pose = new Float32Array(168);
    pose[156] = 1;
    let event = null;
    for (let timestamp = 0; timestamp <= 1200 && event?.type !== 'completed'; timestamp += intervalMs) {
      event = segmenter.push(pose, timestamp);
    }
    return event;
  };
  const desktop = runAtCadence(1000 / 30);
  const mobile = runAtCadence(1000 / 15);
  assert.equal(desktop?.reason, 'stable-hold');
  assert.equal(mobile?.reason, 'stable-hold');
  assert.ok(Math.abs(desktop.durationMs - mobile.durationMs) < 80);
});

test('time-aware resampling preserves motion timing through dropped frames', () => {
  const frames = [Float32Array.of(0), Float32Array.of(10), Float32Array.of(20)];
  const sampled = resampleTimedFrames(frames, [0, 100, 400], 5);
  assert.deepEqual(sampled.map((frame) => Math.round(frame[0])), [0, 10, 13, 17, 20]);
});

test('adaptive inference cadence backs off when measured mobile latency rises', () => {
  const controller = new AdaptiveInferenceController({ mobile: true, inferenceIntervalMs: 50 });
  [100, 110, 120, 130].forEach((latency) => controller.recordLatency(latency));
  assert.ok(controller.inferenceIntervalMs >= 100);
  assert.ok(controller.inferenceIntervalMs <= 250);
});


test('holistic tracking bridges short landmark dropouts and expires long ones', () => {
  const stabilizer = new HolisticTrackingStabilizer({ landmarkAlpha: 0.5, maxGapMs: { hand: 200 } });
  const hand = Array.from({ length: 21 }, (_, index) => ({ x: index / 100, y: 0.2, z: 0 }));
  const first = stabilizer.update({ rightHandLandmarks: hand }, 1000);
  assert.equal(first.rightHandLandmarks.length, 21);
  assert.equal(first._recovered.rightHandLandmarks, false);

  const bridged = stabilizer.update({}, 1120);
  assert.equal(bridged.rightHandLandmarks.length, 21);
  assert.equal(bridged._recovered.rightHandLandmarks, true);
  assert.equal(isFreshHolisticResult(bridged, 1400, 300), true);

  const expired = stabilizer.update({}, 1250);
  assert.equal(expired.rightHandLandmarks, null);
  assert.equal(isFreshHolisticResult(expired, 1600, 300), false);
});


test('hand selection removes a recovered ghost when the other hand is live', () => {
  const hand = Array.from({ length: 21 }, (_, index) => ({ x: index / 100, y: 0.2, z: 0 }));
  const selected = selectActiveHandObjects({
    rightHandLandmarks: hand,
    leftHandLandmarks: hand.map((point) => ({ ...point, x: point.x + 0.2 })),
    _recovered: { rightHandLandmarks: true, leftHandLandmarks: false },
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].isLeft, true);
  assert.equal(selected[0].recovered, false);
});


test('static and dynamic handedness transforms are exact involutions', () => {
  const staticFrame = Float32Array.from({ length: 72 }, (_, index) => index / 10 - 2);
  const dynamicFrame = Float32Array.from({ length: 168 }, (_, index) => index / 13 - 4);
  assert.deepEqual(
    [...mirrorStaticFeatures(mirrorStaticFeatures(staticFrame))],
    [...staticFrame],
  );
  assert.deepEqual(
    [...mirrorDynamicFrame(mirrorDynamicFrame(dynamicFrame))],
    [...dynamicFrame],
  );
});


test('fingerspelled Z requires a deliberate two-turn index-tip stroke', () => {
  const tracker = new DynamicGestureTracker();
  const points = [
    [0.40, 0.30], [0.43, 0.31], [0.47, 0.32], [0.52, 0.33],
    [0.48, 0.35], [0.44, 0.37], [0.40, 0.39],
    [0.45, 0.41], [0.50, 0.43], [0.55, 0.45],
  ];
  tracker.history = points.map(([x, y], index) => ({
    time: index * 33,
    indexTip: { x, y, z: 0 },
    anat: { isPointing: true },
  }));
  assert.equal(tracker.detectFingerspellingMotion(), 'Z');

  tracker.history = points.map((_, index) => ({
    time: index * 33,
    indexTip: { x: 0.5 + index * 0.0005, y: 0.35, z: 0 },
    anat: { isPointing: true },
  }));
  assert.equal(tracker.detectFingerspellingMotion(), null);
});


const physicalSequence = (extensionRatios, { left = false, twoHands = false, verticalOffset = 0 } = {}) => {
  const sequence = new Float32Array(60 * 168);
  for (let frame = 0; frame < 60; frame += 1) {
    const offset = frame * 168;
    const sides = twoHands ? [false, true] : [left];
    for (const isLeft of sides) {
      const shapeOffset = isLeft ? 72 : 0;
      const presenceOffset = isLeft ? 157 : 156;
      sequence[offset + presenceOffset] = 1;
      // Middle MCP establishes a unit palm scale.
      sequence[offset + shapeOffset + (9 - 1) * 3 + 1] = -1;
      [4, 8, 12, 16, 20].forEach((landmark, index) => {
        sequence[offset + shapeOffset + (landmark - 1) * 3 + 1] = -extensionRatios[index];
      });
    }
    if (twoHands) sequence[offset + 165] = verticalOffset;
  }
  return sequence;
};

const pairProbabilities = (first, second) => [
  { label: first, probability: 0.72 },
  { label: second, probability: 0.24 },
  { label: first.startsWith('FSL_') ? 'FSL_HI' : 'ASL_HI', probability: 0.04 },
];

test('physical phrase resolver corrects the reported classes for either hand', () => {
  for (const left of [false, true]) {
    const thankYou = physicalSequence([1.45, 1.97, 2.03, 1.87, 1.52], { left });
    assert.equal(
      resolveDynamicConfusions(
        pairProbabilities('ASL_GOOD', 'ASL_THANK_YOU'),
        thankYou,
        'ASL',
      ).probabilities[0].label,
      'ASL_THANK_YOU',
    );

    const good = physicalSequence(
      [2.0, 2.2, 2.2, 2.0, 1.65],
      { left, twoHands: true, verticalOffset: 0.20 },
    );
    assert.equal(
      resolveDynamicConfusions(
        pairProbabilities('ASL_GOOD', 'ASL_THANK_YOU'),
        good,
        'ASL',
      ).probabilities[0].label,
      'ASL_GOOD',
    );

    // Simulate the live failure: noisy palm scale makes Thank You look as
    // extended as Good, but there is no reliable receiving hand below it.
    const noisyThankYou = physicalSequence([1.9, 2.2, 2.2, 2.0, 1.65], { left });
    assert.equal(
      resolveDynamicConfusions(
        pairProbabilities('ASL_GOOD', 'ASL_THANK_YOU'),
        noisyThankYou,
        'ASL',
      ).probabilities[0].label,
      'ASL_THANK_YOU',
    );

    const mahal = physicalSequence([1.0, 1.8, 0.8, 0.8, 1.6], { left });
    assert.ok(summarizeDynamicHandshape(mahal).ilyLikeRatio > 0.9);
    assert.equal(
      resolveDynamicConfusions(
        pairProbabilities('FSL_MAGANDANG_HAPON', 'FSL_MAHAL_KITA'),
        mahal,
        'FSL',
      ).probabilities[0].label,
      'FSL_MAHAL_KITA',
    );

    const gabi = physicalSequence([1.7, 1.5, 1.4, 1.2, 1.0], { left });
    assert.equal(
      resolveDynamicConfusions(
        pairProbabilities('FSL_MAGANDANG_HAPON', 'FSL_MAGANDANG_GABI'),
        gabi,
        'FSL',
      ).probabilities[0].label,
      'FSL_MAGANDANG_GABI',
    );

    const afternoon = physicalSequence([1.1, 1.58, 1.65, 1.60, 1.45], { left });
    assert.equal(
      resolveDynamicConfusions(
        pairProbabilities('ASL_MORNING', 'ASL_AFTERNOON'),
        afternoon,
        'ASL',
      ).probabilities[0].label,
      'ASL_AFTERNOON',
    );
  }
});


test('runtime profile provides bounded camera and rendering defaults', () => {
  const profile = getRuntimeProfile();
  const constraints = cameraConstraints(profile);
  assert.ok(profile.inferenceIntervalMs >= 30);
  assert.ok(profile.maxPixelRatio >= 1 && profile.maxPixelRatio <= 2);
  assert.equal(constraints.facingMode, 'user');
  assert.ok(constraints.frameRate.max <= 30);
});

test('static features are invariant to camera translation and scale', () => {
  const hand = Array.from({ length: 21 }, (_, index) => ({
    x: 0.25 + (index % 5) * 0.018,
    y: 0.30 + Math.floor(index / 5) * 0.026,
    z: index * 0.001,
  }));
  const transformed = hand.map((point) => ({
    x: point.x * 1.7 + 0.08,
    y: point.y * 1.7 - 0.11,
    z: point.z * 1.7 + 0.03,
  }));
  assert.deepEqual(extractFeatures72(transformed), extractFeatures72(hand));
});

test('motion-dependent letters trace paths while ordinary letters stay still', () => {
  const jPositions = [0, 0.7, 1.4, 2.1].map((time) => getLetterMotionOffset('ASL_J', time));
  const zPositions = [0, 0.7, 1.4, 2.1].map((time) => getLetterMotionOffset('ASL_Z', time));
  const enyePositions = [0.2, 0.5, 0.8].map((time) => getLetterMotionOffset('FSL_Ñ', time));
  assert.ok(new Set(jPositions.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)).size > 2);
  assert.ok(new Set(zPositions.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)).size > 2);
  assert.ok(enyePositions.some(([x]) => Math.abs(x) > 0.02));
  assert.deepEqual(getLetterMotionOffset('ASL_A', 1), [0, 0, 0]);
});


test('recorded avatar playback starts in preparation and reaches a stable final hold', () => {
  assert.equal(getRecordedPlaybackProgress(0, 2), 0);
  assert.equal(getRecordedPlaybackProgress(0.2, 2), 0);
  assert.ok(getRecordedPlaybackProgress(1.22, 2) > 0.45);
  assert.equal(getRecordedPlaybackProgress(2.4, 2), 1);
  assert.equal(getRecordedPlaybackProgress(2.8, 2), 1);
});

test('gesture safety rejects only a sustained isolated middle finger', () => {
  const hand = Array.from({ length: 21 }, () => ({ x: 0, y: 0.62, z: 0 }));
  hand[0] = { x: 0, y: 0.82, z: 0 };
  hand[9] = { x: 0, y: 0.55, z: 0 };
  hand[10] = { x: 0, y: 0.38, z: 0 };
  hand[11] = { x: 0, y: 0.2, z: 0 };
  hand[12] = { x: 0, y: 0.02, z: 0 };
  [[5, 6, 7, 8], [13, 14, 15, 16], [17, 18, 19, 20]].forEach((indices, finger) => {
    indices.forEach((index, joint) => {
      hand[index] = { x: (finger - 1) * 0.12, y: 0.55 + (joint % 2) * 0.06, z: 0 };
    });
  });
  assert.equal(isIsolatedMiddleFingerGesture(hand), true);

  const validMultiFingerSign = hand.map((point) => ({ ...point }));
  validMultiFingerSign[8] = { x: -0.12, y: 0.02, z: 0 };
  assert.equal(isIsolatedMiddleFingerGesture(validMultiFingerSign), false);

  const gate = new GestureRejectionGate(3, 2);
  assert.equal(gate.update(true), false);
  assert.equal(gate.update(true), false);
  assert.equal(gate.update(true), true);
  assert.equal(gate.update(false), true);
  assert.equal(gate.update(false), false);
});


test('avatar pose library covers every trained label and preserves the ILY handshape', async () => {
  const [library, staticMetadata, dynamicMetadata] = await Promise.all([
    readFile('public/models/avatar_poses.json', 'utf8').then(JSON.parse),
    readFile('public/models/static_mlp/metadata.json', 'utf8').then(JSON.parse),
    readFile('public/models/dynamic_gru/metadata.json', 'utf8').then(JSON.parse),
  ]);
  assert.equal(library.schemaVersion, 2);
  assert.deepEqual(Object.keys(library.static).sort(), [...staticMetadata.labels].sort());
  assert.deepEqual(Object.keys(library.dynamic).sort(), [...dynamicMetadata.labels].sort());

  for (const [label, pose] of Object.entries(library.static)) {
    assert.equal(pose.hand.length, 60, `${label} must contain all 20 non-wrist hand landmarks`);
    assert.ok(pose.hand.every(Number.isFinite), `${label} contains an invalid hand coordinate`);
  }
  for (const [label, pose] of Object.entries(library.dynamic)) {
    assert.equal(pose.frames.length, 60, `${label} must preserve the complete recorded motion`);
    assert.equal(pose.fps, 30, `${label} must declare its capture rate`);
    assert.equal(pose.durationSeconds, 2, `${label} must declare its real duration`);
    assert.ok(['left', 'right'].includes(pose.dominantSide), `${label} must declare handedness`);
    const renderedSides = new Set();
    for (const frame of pose.frames) {
      assert.ok(frame.r || frame.l, `${label} has a frame without either hand`);
      if (frame.r) renderedSides.add('r');
      if (frame.l) renderedSides.add('l');
      for (const side of ['r', 'l']) {
        if (!frame[side]) continue;
        assert.equal(frame[side].length, 60, `${label} ${side} hand is incomplete`);
        assert.ok(frame[side].every(Number.isFinite), `${label} ${side} hand contains an invalid coordinate`);
        assert.equal(frame[`${side}w`].length, 3, `${label} ${side} wrist is incomplete`);
        assert.ok(frame[`${side}w`].every(Number.isFinite), `${label} ${side} wrist contains an invalid coordinate`);
      }
    }
    if (!pose.twoHanded) {
      assert.equal(renderedSides.size, 1, `${label} must not switch dominant hands during playback`);
      assert.ok(renderedSides.has(pose.dominantSide[0]), `${label} must render its declared dominant hand`);
    } else {
      assert.deepEqual([...renderedSides].sort(), ['l', 'r'], `${label} must render both hands continuously`);
    }
    for (const side of renderedSides) {
      const wristKey = `${side}w`;
      for (let index = 1; index < pose.frames.length; index += 1) {
        const previous = pose.frames[index - 1][wristKey];
        const current = pose.frames[index][wristKey];
        const step = Math.hypot(...current.map((value, axis) => value - previous[axis]));
        assert.ok(step <= 0.451, `${label} ${side} wrist contains a tracking teleport`);
      }
    }
  }

  const ily = library.dynamic.ASL_I_LOVE_YOU;
  assert.equal(ily.twoHanded, false);
  const side = ily.dominantSide[0];
  const medianExtension = (landmark) => {
    const distances = ily.frames.map((frame) => {
      const offset = (landmark - 1) * 3;
      return Math.hypot(...frame[side].slice(offset, offset + 3));
    }).sort((first, second) => first - second);
    return distances[Math.floor(distances.length / 2)];
  };
  assert.ok(medianExtension(4) > 0.8, 'thumb must be extended');
  assert.ok(medianExtension(8) > 1.4, 'index must be extended');
  assert.ok(medianExtension(20) > 1.3, 'pinky must be extended');
  assert.ok(medianExtension(12) < 1.15, 'middle finger must be folded');
  assert.ok(medianExtension(16) < 1.15, 'ring finger must be folded');

  for (const label of ['FSL_MAHAL_KITA', 'FSL_MAGANDANG_HAPON', 'FSL_MAGANDANG_GABI']) {
    assert.equal(library.dynamic[label].twoHanded, false, `${label} is a one-hand recording`);
  }
  for (const label of ['ASL_GOOD', 'ASL_MORNING', 'ASL_AFTERNOON', 'ASL_THANK_YOU']) {
    assert.equal(library.dynamic[label].twoHanded, true, `${label} requires both recorded hands`);
  }
  assert.equal(
    new Set(Object.values(library.dynamic).map((pose) => JSON.stringify(pose.frames))).size,
    dynamicMetadata.labels.length,
    'every phrase must have a distinct recorded performance',
  );
});


test('text-to-sign matching is dialect-locked and preserves full phrases', () => {
  assert.equal(normalizeSignText('  What’s up?! '), "what's up");
  assert.equal(findDialectSign('Thank you', 'ASL').key, 'THANK_YOU');
  assert.equal(findDialectSign('Magandang Gabi', 'FSL').key, 'MAGANDANG_GABI');
  assert.equal(findDialectSign('Mahal Kita', 'FSL').key, 'MAHAL_KITA');
  assert.equal(findDialectSign('Thank you', 'FSL'), null);
  assert.equal(findDialectSign('Magandang Gabi', 'ASL'), null);

  for (const dialect of ['ASL', 'FSL']) {
    const catalog = DATASET_CATALOG[dialect];
    for (const phrase of catalog.phrases) {
      assert.equal(
        findDialectSign(phrase.key.replaceAll('_', ' '), dialect)?.key,
        phrase.key,
        `${dialect} ${phrase.key} must resolve to its own trained animation`,
      );
    }
    for (const character of catalog.letters) {
      assert.equal(findDialectSign(`letter ${character}`, dialect)?.key, character);
    }
    for (const number of catalog.numbers) {
      assert.equal(findDialectSign(`number ${number}`, dialect)?.key, number);
    }
  }
});


test('text-to-sign sequences use longest phrases, word pauses, and repeated-letter pauses', () => {
  const sentence = createSignSequence('Hello, thank you!', 'ASL');
  assert.deepEqual(sentence.sequence.map((step) => step.key), ['HELLO', 'NONE', 'THANK_YOU']);
  assert.deepEqual(sentence.sequence.map((step) => step.type), ['phrase', 'gap', 'phrase']);

  const repeated = createSignSequence('book', 'ASL');
  assert.deepEqual(repeated.sequence.map((step) => step.key), ['B', 'O', 'NONE', 'O', 'K']);
  assert.equal(repeated.sequence[2].label, 'repeat pause');

  const fslEnye = createSignSequence('letter ñ', 'FSL');
  assert.deepEqual(fslEnye.sequence.map((step) => step.key), ['Ñ']);
  assert.equal(createSignSequence('🙂', 'ASL').sequence.length, 0);
});


test('quantized static MLP loads and returns 73 finite logits', async () => {
  const model = await loadQuantizedModel('public/models/static_mlp');
  const input = tf.zeros([1, 72]);
  const output = model.predict(input);
  const values = await output.data();
  assert.equal(model.countParams(), 17961);
  assert.equal(values.length, 73);
  assert.ok(values.every(Number.isFinite));
  input.dispose(); output.dispose(); model.dispose();
});


test('quantized dynamic GRU loads and returns 44 finite logits', async () => {
  const model = await loadQuantizedModel('public/models/dynamic_gru');
  const input = tf.zeros([1, 60, 168]);
  const output = model.predict(input);
  const values = await output.data();
  assert.equal(model.countParams(), 35012);
  assert.equal(values.length, 44);
  assert.ok(values.every(Number.isFinite));
  input.dispose(); output.dispose(); model.dispose();
});
