import React, { useState, useEffect } from 'react';
import {
  Camera,
  Mic,
  Sun,
  Moon,
  CheckCircle2,
  HelpCircle,
  Monitor,
  RefreshCw,
} from 'lucide-react';

export default function SettingsPage() {
  const [cameraPermission, setCameraPermission] = useState('Checking...');
  const [micPermission, setMicPermission] = useState('Checking...');
  const [outputLanguage, setOutputLanguage] = useState(
    () => localStorage.getItem('signsync_dialect') || localStorage.getItem('signsync_lang') || 'ASL'
  );
  const [theme, setTheme] = useState(() => localStorage.getItem('signsync_theme') || 'dark');
  const [performanceMode, setPerformanceMode] = useState(
    () => localStorage.getItem('signsync_performance_mode') || 'auto'
  );
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [statusNotification, setStatusNotification] = useState(null);

  // Check hardware permissions
  const checkPermissions = async () => {
    setIsCheckingPermissions(true);
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const camStatus = await navigator.permissions.query({ name: 'camera' });
        setCameraPermission(camStatus.state === 'granted' ? 'Granted' : camStatus.state === 'denied' ? 'Blocked' : 'Prompt on Use');
      } catch {
        setCameraPermission('Allowed on Use');
      }

      try {
        const micStatus = await navigator.permissions.query({ name: 'microphone' });
        setMicPermission(micStatus.state === 'granted' ? 'Granted' : micStatus.state === 'denied' ? 'Blocked' : 'Prompt on Use');
      } catch {
        setMicPermission('Allowed on Use');
      }
    } else {
      setCameraPermission('Allowed on Use');
      setMicPermission('Allowed on Use');
    }
    setTimeout(() => setIsCheckingPermissions(false), 350);
  };

  useEffect(() => {
    // Sync language state from localStorage across tabs/pages
    const syncLang = () => {
      const savedLang = localStorage.getItem('signsync_dialect') || localStorage.getItem('signsync_lang') || 'ASL';
      setOutputLanguage(savedLang);
    };

    window.addEventListener('storage', syncLang);
    window.addEventListener('signsync_lang_change', syncLang);

    checkPermissions();

    return () => {
      window.removeEventListener('storage', syncLang);
      window.removeEventListener('signsync_lang_change', syncLang);
    };
  }, []);

  const handleLanguageChange = (langCode) => {
    setOutputLanguage(langCode);
    localStorage.setItem('signsync_dialect', langCode);
    localStorage.setItem('signsync_lang', langCode);
    window.dispatchEvent(new Event('signsync_lang_change'));
    showNotification(`Default dialect switched to ${langCode}`);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('signsync_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    showNotification(`Theme updated to ${newTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}`);
  };

  const handlePerformanceModeChange = (mode) => {
    setPerformanceMode(mode);
    localStorage.setItem('signsync_performance_mode', mode);
    window.dispatchEvent(new Event('signsync_performance_mode_change'));
    showNotification('Camera performance mode saved. Restart the camera to apply it.');
  };

  const showNotification = (msg) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3000);
  };

  return (
    <div className="fade-in responsive-page settings-page" style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem 0 3.5rem 0' }}>
      {/* 1. Header & Overview (Open Editorial, No Cards) */}
      <section style={{ paddingBottom: '2.25rem', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
          <span className="badge badge-blue">Preferences</span>
          <span className="badge badge-green">Device Config</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 4vw, 2.8rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            marginBottom: '0.75rem',
          }}
        >
          Settings & Preferences
        </h1>

        <p
          style={{
            fontSize: '1.05rem',
            color: 'var(--text-secondary)',
            maxWidth: '680px',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Configure hardware permissions, choose your default sign language dialect, adjust visual appearance, and review on-device tracking requirements.
        </p>

        {statusNotification && (
          <div
            style={{
              marginTop: '1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.95rem',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: 'var(--success)',
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
            {statusNotification}
          </div>
        )}
      </section>

      {/* 2. Section 01: Hardware & Media Permissions */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2.5rem',
          alignItems: 'start',
          padding: '2.5rem 0',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.65rem' }}>
            Camera & Microphone Access
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Real-time hand posture classification and voice-to-sign input run 100% locally in your browser. Video and audio streams are processed in memory and are never uploaded or retained.
          </p>
        </div>

        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Webcam Permission Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Camera className="w-4 h-4 text-sky-400" />
                <div>
                  <strong style={{ fontSize: '0.88rem', display: 'block', color: 'var(--text-primary)' }}>
                    Webcam Video
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Required for live hand landmark detection
                  </span>
                </div>
              </div>

              <span
                className={`badge ${cameraPermission === 'Granted'
                  ? 'badge-green'
                  : cameraPermission === 'Blocked'
                    ? 'badge-red'
                    : 'badge-blue'
                  }`}
                style={{ fontSize: '0.75rem' }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: cameraPermission === 'Granted' ? '#10b981' : '#f59e0b',
                    marginRight: '4px',
                  }}
                />
                {cameraPermission}
              </span>
            </div>

            {/* Microphone Permission Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Mic className="w-4 h-4 text-emerald-400" />
                <div>
                  <strong style={{ fontSize: '0.88rem', display: 'block', color: 'var(--text-primary)' }}>
                    Microphone Audio
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Used for speech-to-sign input in Translator
                  </span>
                </div>
              </div>

              <span
                className={`badge ${micPermission === 'Granted'
                  ? 'badge-green'
                  : micPermission === 'Blocked'
                    ? 'badge-red'
                    : 'badge-blue'
                  }`}
                style={{ fontSize: '0.75rem' }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: micPermission === 'Granted' ? '#10b981' : '#f59e0b',
                    marginRight: '4px',
                  }}
                />
                {micPermission}
              </span>
            </div>
          </div>

          <button
            className="btn btn-outline"
            onClick={checkPermissions}
            disabled={isCheckingPermissions}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingPermissions ? 'animate-spin' : ''}`} />
            {isCheckingPermissions ? 'Verifying Permissions...' : 'Re-check Hardware Access'}
          </button>
        </div>
      </section>

      {/* 3. Section 02: Dialect & Recognition Preferences */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2.5rem',
          alignItems: 'start',
          padding: '2.5rem 0',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.65rem' }}>
            Default Sign Dialect
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Sets the primary neural classifier and synthesis engine. Changes here synchronize instantly with both the Real-Time Translator and Learning Center.
          </p>
        </div>

        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <button
              className={`btn ${outputLanguage === 'ASL' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleLanguageChange('ASL')}
              style={{
                padding: '0.9rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                gap: '0.35rem',
                height: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>ASL</span>
                {outputLanguage === 'ASL' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <span style={{ fontSize: '0.76rem', opacity: outputLanguage === 'ASL' ? 0.95 : 0.75, lineHeight: 1.35 }}>
                American Sign Language (English translation)
              </span>
            </button>

            <button
              className={`btn ${outputLanguage === 'FSL' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleLanguageChange('FSL')}
              style={{
                padding: '0.9rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                gap: '0.35rem',
                height: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>FSL</span>
                {outputLanguage === 'FSL' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <span style={{ fontSize: '0.76rem', opacity: outputLanguage === 'FSL' ? 0.95 : 0.75, lineHeight: 1.35 }}>
                Filipino Sign Language (Tagalog & Filipino translation)
              </span>
            </button>
          </div>
        </div>
      </section>

      <section
        style={{ padding: '2.5rem 0', borderBottom: '1px solid var(--glass-border)' }}
      >
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.65rem' }}>
          Camera Performance
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Auto measures live processing speed. Performance mode lowers camera workload on older phones; Accuracy mode uses the highest pose model on capable devices.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {[
            ['auto', 'Auto (Recommended)'],
            ['performance', 'Performance'],
            ['quality', 'Accuracy'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn ${performanceMode === value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handlePerformanceModeChange(value)}
              aria-pressed={performanceMode === value}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Visual Appearance & Theme */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2.5rem',
          alignItems: 'start',
          padding: '2.5rem 0',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.65rem' }}>
            Visual Appearance
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Choose between dark mode with high-contrast skeleton overlays or clean light mode.
          </p>
        </div>

        <div>
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--bg-surface)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.3rem',
              gap: '0.3rem',
            }}
          >
            <button
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleThemeChange('dark')}
              style={{
                padding: '0.45rem 1.15rem',
                fontSize: '0.82rem',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark Mode (Default)
            </button>

            <button
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleThemeChange('light')}
              style={{
                padding: '0.45rem 1.15rem',
                fontSize: '0.82rem',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Sun className="w-3.5 h-3.5" />
              Light Mode
            </button>
          </div>
        </div>
      </section>

      {/* 5. Section 04: Environment & System Guidelines */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2.5rem',
          alignItems: 'start',
          padding: '2.5rem 0',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.65rem' }}>
            System Environment & Best Practices
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Tips for maximizing MediaPipe and sequence-GRU accuracy during live tracking.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <HelpCircle className="w-4 h-4 text-sky-400" />
              Optimal Camera Framing
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>
                <strong>Even Lighting:</strong> Ensure hands and torso are clearly illuminated without heavy backlighting.
              </li>
              <li>
                <strong>Plain Background:</strong> High contrast between skin tone and background ensures optimal landmark extraction.
              </li>
              <li>
                <strong>Distance:</strong> Position yourself 2–3 feet from the lens with hands visible inside the frame.
              </li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Monitor className="w-4 h-4 text-emerald-400" />
              Browser & GPU Support
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>
                <strong>Hardware Acceleration:</strong> WebGL 2.0 enabled in Chrome, Edge, or Firefox delivers ~30–60 FPS inference.
              </li>
              <li>
                <strong>Webcam Resolution:</strong> 720p or 1080p camera feed recommended for finger joint precision.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
