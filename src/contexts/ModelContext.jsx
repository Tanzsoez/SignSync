import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  inferDynamic,
  inferStatic,
  loadRecognitionModels,
  subscribeToModelRuntime,
} from '../services/modelRuntime';

const ModelContext = createContext(null);

export function useModel() {
  const context = useContext(ModelContext);
  if (!context) throw new Error('useModel must be used within <ModelProvider>');
  return context;
}

export function ModelProvider({ children }) {
  const promiseRef = useRef(null);
  const [state, setState] = useState({
    hasStartedLoading: false,
    isModelLoaded: false,
    loadingProgress: 0,
    loadedBytes: 0,
    totalBytes: 0,
    loadingStage: 'Recognition models are ready to download.',
    loadingError: null,
    modelVersion: null,
    backend: null,
  });

  useEffect(() => subscribeToModelRuntime((message) => {
    if (message.type === 'PROGRESS') {
      setState((current) => ({
        ...current,
        hasStartedLoading: true,
        loadingProgress: message.progress,
        loadedBytes: message.loadedBytes,
        totalBytes: message.totalBytes,
        loadingStage: message.stage,
        loadingError: null,
      }));
    } else if (message.type === 'READY') {
      setState((current) => ({
        ...current,
        isModelLoaded: true,
        loadingProgress: 100,
        loadingStage: `Recognition ready on ${message.backend.toUpperCase()}`,
        modelVersion: message.version,
        backend: message.backend,
        loadingError: null,
      }));
    } else if (message.type === 'LOAD_ERROR') {
      setState((current) => ({
        ...current,
        isModelLoaded: false,
        loadingError: message.error,
        loadingStage: 'Recognition models failed to load',
      }));
      promiseRef.current = null;
    }
  }), []);

  const loadModels = useCallback(() => {
    if (promiseRef.current) return promiseRef.current;
    setState((current) => ({
      ...current,
      hasStartedLoading: true,
      isModelLoaded: false,
      loadingError: null,
      loadingStage: 'Starting recognition worker…',
    }));
    promiseRef.current = loadRecognitionModels().catch((error) => {
      promiseRef.current = null;
      throw error;
    });
    return promiseRef.current;
  }, []);

  const retryLoading = useCallback(() => {
    promiseRef.current = null;
    return loadModels();
  }, [loadModels]);

  return (
    <ModelContext.Provider value={{
      ...state,
      loadModels,
      retryLoading,
      predictStatic: inferStatic,
      predictDynamic: inferDynamic,
    }}>
      {children}
    </ModelContext.Provider>
  );
}
