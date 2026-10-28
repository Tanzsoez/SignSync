let worker = null;
let nextRequestId = 1;
const pending = new Map();
const listeners = new Set();

function emit(message) {
  listeners.forEach((listener) => listener(message));
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/modelWorker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'PROGRESS' || data.type === 'READY' || data.type === 'LOAD_ERROR') {
      emit(data);
    }
    if (!data.requestId) return;
    const request = pending.get(data.requestId);
    if (!request) return;
    pending.delete(data.requestId);
    if (data.type === 'INFERENCE_ERROR') request.reject(new Error(data.error));
    else request.resolve(data.prediction ?? null);
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || 'Recognition worker failed');
    pending.forEach(({ reject }) => reject(error));
    pending.clear();
    emit({ type: 'LOAD_ERROR', error: error.message });
  };
  return worker;
}

function request(type, payload, transfer = []) {
  const requestId = nextRequestId++;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    getWorker().postMessage({ type, requestId, ...payload }, transfer);
  });
}

export function subscribeToModelRuntime(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadRecognitionModels() {
  return request('LOAD', {});
}

export function inferStatic(features, dialect) {
  const values = Float32Array.from(features);
  return request('INFER_STATIC', { features: values, dialect }, [values.buffer]);
}

export function inferDynamic(sequence, dialect) {
  const values = Float32Array.from(sequence);
  return request('INFER_DYNAMIC', { sequence: values, dialect }, [values.buffer]);
}
