import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import { loadLayersModel } from '@tensorflow/tfjs-layers';
import { predictDynamicSequence, predictStatic } from '../utils/sequenceInference';

const MANIFEST_URL = '/models/model_manifest.json';
let loadPromise = null;
let staticModel = null;
let staticMetadata = null;
let dynamicModel = null;
let dynamicMetadata = null;

function progress(stage, fraction, loadedBytes = 0, totalBytes = 0) {
  self.postMessage({
    type: 'PROGRESS',
    stage,
    progress: Math.max(0, Math.min(100, Math.round(fraction * 100))),
    loadedBytes: Math.round(loadedBytes),
    totalBytes: Math.round(totalBytes),
  });
}

async function fetchJSON(url, version) {
  const response = await fetch(`${url}?modelVersion=${encodeURIComponent(version)}`, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
  return response.json();
}

async function loadModel(url, version, inputShape, onProgress) {
  const model = await loadLayersModel(
    `${url}?modelVersion=${encodeURIComponent(version)}`,
    { onProgress },
  );
  const warmup = tf.tidy(() => model.predict(tf.zeros(inputShape, 'float32')));
  if (Array.isArray(warmup)) warmup.forEach((tensor) => tensor.dispose());
  else warmup.dispose();
  return model;
}

function loadModels() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    progress('Preparing TensorFlow runtime…', 0.02);
    await tf.ready();
    progress(`TensorFlow ${tf.getBackend().toUpperCase()} backend ready`, 0.08);

    const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status} loading model manifest`);
    const manifest = await response.json();
    const version = String(manifest.version || 'hybrid-v2');
    const staticBytes = Number(manifest.staticModelBytes || 0);
    const dynamicBytes = Number(manifest.dynamicModelBytes || 0);
    const totalBytes = staticBytes + dynamicBytes;
    let staticFraction = 0;
    let dynamicFraction = 0;
    const reportDownload = () => {
      const loaded = staticFraction * staticBytes + dynamicFraction * dynamicBytes;
      progress('Downloading and preparing recognition models…', 0.08 + (loaded / Math.max(1, totalBytes)) * 0.84, loaded, totalBytes);
    };

    [staticMetadata, dynamicMetadata, staticModel, dynamicModel] = await Promise.all([
      fetchJSON('/models/static_mlp/metadata.json', version),
      fetchJSON('/models/dynamic_gru/metadata.json', version),
      loadModel('/models/static_mlp/model.json', version, [1, 72], (value) => {
        staticFraction = value;
        reportDownload();
      }),
      loadModel('/models/dynamic_gru/model.json', version, [1, 60, 168], (value) => {
        dynamicFraction = value;
        reportDownload();
      }),
    ]);

    progress('Recognition models ready', 1, totalBytes, totalBytes);
    self.postMessage({ type: 'READY', backend: tf.getBackend(), version });
    return { backend: tf.getBackend(), version };
  })().catch((error) => {
    loadPromise = null;
    self.postMessage({ type: 'LOAD_ERROR', error: error.message });
    throw error;
  });
  return loadPromise;
}

self.onmessage = async ({ data }) => {
  const { type, requestId } = data;
  try {
    if (type === 'LOAD') {
      const result = await loadModels();
      self.postMessage({ type: 'LOAD_RESULT', requestId, result });
      return;
    }
    await loadModels();
    let prediction = null;
    if (type === 'INFER_STATIC') {
      prediction = await predictStatic({
        tf, model: staticModel, metadata: staticMetadata,
        features: data.features, dialect: data.dialect,
      });
    } else if (type === 'INFER_DYNAMIC') {
      prediction = await predictDynamicSequence({
        tf, model: dynamicModel, metadata: dynamicMetadata,
        ringBuffer: { toResampledInput: () => data.sequence }, dialect: data.dialect,
      });
    }
    self.postMessage({ type: 'INFERENCE_RESULT', requestId, prediction });
  } catch (error) {
    self.postMessage({ type: 'INFERENCE_ERROR', requestId, error: error.message });
  }
};
