import React, { useEffect, useState } from 'react';

const diagnosticsEnabled = () => {
  try {
    return new URLSearchParams(window.location.search).has('diagnostics');
  } catch {
    return false;
  }
};

export default function RuntimeDiagnosticsPanel({ source }) {
  const [metrics, setMetrics] = useState(null);
  const enabled = diagnosticsEnabled();

  useEffect(() => {
    if (!enabled) return undefined;
    const update = (event) => {
      if (!source || event.detail?.source === source) setMetrics(event.detail);
    };
    window.addEventListener('signsync:diagnostics', update);
    return () => window.removeEventListener('signsync:diagnostics', update);
  }, [enabled, source]);

  if (!enabled) return null;
  return (
    <aside
      aria-label="Runtime diagnostics"
      style={{
        position: 'fixed', right: 10, bottom: 10, zIndex: 9999,
        width: 230, padding: 10, borderRadius: 8,
        color: '#dbeafe', background: 'rgba(2, 6, 23, 0.92)',
        border: '1px solid rgba(56, 189, 248, 0.45)',
        font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
        pointerEvents: 'none',
      }}
    >
      <strong>SignSync diagnostics</strong>
      {metrics ? Object.entries(metrics).map(([key, value]) => (
        <div key={key}>{key}: {String(value)}</div>
      )) : <div>Collecting measurements…</div>}
    </aside>
  );
}
