let holisticScriptPromise = null;

export function loadHolistic() {
  if (window.Holistic) return Promise.resolve(window.Holistic);
  if (holisticScriptPromise) return holisticScriptPromise;
  holisticScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/holistic.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      if (window.Holistic) {
        resolve(window.Holistic);
        return;
      }
      holisticScriptPromise = null;
      reject(new Error('Holistic did not initialize'));
    };
    script.onerror = () => {
      // Do not cache a transient CDN failure forever. A later user action can retry.
      holisticScriptPromise = null;
      reject(new Error('Unable to download MediaPipe Holistic'));
    };
    document.head.appendChild(script);
  });
  return holisticScriptPromise;
}
