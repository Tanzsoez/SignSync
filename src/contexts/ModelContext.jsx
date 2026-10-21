import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ModelContext = createContext(null);
const MANIFEST_URL = '/models/model_manifest.json';

async function fetchJSON(url, version) {
  const response = await fetch(`${url}?modelVersion=${encodeURIComponent(version)}`, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
  return response.json();
}

async function loadLayersModel(tf, url, version, inputShape) {
  const model = await tf.loadLayersModel(`${url}?modelVersion=${encodeURIComponent(version)}`);
  const warmup = tf.tidy(() => model.predict(tf.zeros(inputShape, 'float32')));
  if (Array.isArray(warmup)) warmup.forEach((tensor) => tensor.dispose());
  else warmup.dispose();
  return model;
}

export function useModel() {
  const context = useContext(ModelContext);
  if (!context) throw new Error('useModel must be used within <ModelProvider>');
  return context;
}

export function ModelProvider({ children }) {
  const promiseRef = useRef(null);
  const [state, setState] = useState({
    staticModel: null,
    staticMetadata: null,
    dynamicModel: null,
    dynamicMetadata: null,
    hasStartedLoading: false,
    isModelLoaded: false,
    loadingProgress: 0,
    loadedBytes: 0,
    totalBytes: 0,
    loadingStage: 'Recognition models are loaded only when needed.',
    loadingError: null,
  });

  const loadModels = useCallback(() => {
    if (promiseRef.current) return promiseRef.current;
    setState((current) => ({
      ...current,
      hasStartedLoading: true,
      isModelLoaded: false,
      loadingError: null,
      loadingProgress: 5,
      loadingStage: 'Preparing on-device recognition...',
    }));
    promiseRef.current = (async () => {
      try {
        const [tf, manifest] = await Promise.all([
          import('@tensorflow/tfjs'),
          fetch(MANIFEST_URL, { cache: 'no-cache' }).then((response) => response.json()),
        ]);
        await tf.ready();
        const version = String(manifest.version || 'hybrid-v2');
        const totalBytes = Number(manifest.staticModelBytes || 0) + Number(manifest.dynamicModelBytes || 0);
        setState((current) => ({ ...current, totalBytes, loadingProgress: 30, loadingStage: 'Loading static and dynamic recognizers...' }));
        const [staticMetadata, dynamicMetadata, staticModel, dynamicModel] = await Promise.all([
          fetchJSON('/models/static_mlp/metadata.json', version),
          fetchJSON('/models/dynamic_gru/metadata.json', version),
          loadLayersModel(tf, '/models/static_mlp/model.json', version, [1, 72]),
          loadLayersModel(tf, '/models/dynamic_gru/model.json', version, [1, 60, 168]),
        ]);
        setState((current) => ({
          ...current,
          staticModel, staticMetadata, dynamicModel, dynamicMetadata,
          isModelLoaded: true, loadingProgress: 100, loadedBytes: totalBytes,
          loadingStage: `Hybrid recognizer ready on ${tf.getBackend().toUpperCase()}`,
          loadingError: null,
        }));
      } catch (error) {
        console.error('[ModelContext] Hybrid model loading failed:', error);
        // Keep the overlay visible so the user can retry or explicitly continue
        // without recognition. A failed promise must not permanently disable
        // future retries in this session.
        promiseRef.current = null;
        setState((current) => ({
          ...current, isModelLoaded: false, loadingError: error.message,
          loadingStage: 'Recognition models failed to load',
        }));
      }
    })();
    return promiseRef.current;
  }, []);

  const skipLoading = useCallback(() => {
    setState((current) => ({ ...current, isModelLoaded: true }));
  }, []);

  const retryLoading = useCallback(() => {
    promiseRef.current = null;
    return loadModels();
  }, [loadModels]);

  return (
    <ModelContext.Provider value={{ ...state, loadModels, retryLoading, skipLoading }}>
      {children}
    </ModelContext.Provider>
  );
}
