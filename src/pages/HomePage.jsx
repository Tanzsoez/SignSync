import React from 'react';
import { GraduationCap, ArrowRight, Video, Mic, CheckCircle2, Shield, Settings } from 'lucide-react';
import IlyHandIcon from '../components/IlyHandIcon';

export default function HomePage({ setActiveTab }) {
  return (
    <div className="fade-in responsive-page home-page" style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem 0 3rem 0' }}>
      {/* 1. Header / Hero Section (Clean Open Typography, No Cards) */}
      <section style={{ paddingBottom: '2.5rem', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
          <span className="badge badge-blue">ASL</span>
          <span className="badge badge-green">FSL (Filipino Sign)</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 4vw, 3rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            marginBottom: '1rem',
          }}
        >
          SignSync
        </h1>

        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-secondary)',
            maxWidth: '680px',
            lineHeight: 1.6,
            marginBottom: '1.75rem',
          }}
        >
          Real-time dual-hand sign language translation and interactive practice for American Sign Language and Filipino Sign Language.
        </p>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => setActiveTab('translator')}
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <IlyHandIcon className="w-4 h-4" />
            Launch Translator
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            className="btn btn-outline"
            onClick={() => setActiveTab('learning')}
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <GraduationCap className="w-4 h-4" />
            Explore Learning Center
          </button>
        </div>
      </section>

      {/* 2. Core Capabilities (Editorial List Rows with Dividers, No Boxes/Cards) */}
      <section style={{ padding: '2.5rem 0', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.75rem' }}>

          {/* Module 1: Translation Studio */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
              alignItems: 'start',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                Real-Time Translation Studio
              </h2>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Bidirectional communication between signers and non-signers. Automatically converts hand gestures into written text and translates speech or typing into 3D avatar animations.
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Video className="w-4 h-4 text-sky-400 shrink-0" style={{ marginTop: '3px' }} />
                  <div>
                    <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--text-primary)' }}>
                      Sign-to-Text Recognition
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Point your webcam to translate ASL or FSL signs into instant English and Filipino text.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Mic className="w-4 h-4 text-emerald-400 shrink-0" style={{ marginTop: '3px' }} />
                  <div>
                    <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--text-primary)' }}>
                      Speech & Text-to-Sign Avatar
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Speak or type text to watch the 3D user-POV avatar perform corresponding sign gestures.
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-outline"
                onClick={() => setActiveTab('translator')}
                style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
              >
                Open Translator <ArrowRight className="w-3.5 h-3.5 ml-1 inline" />
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: '1px', background: 'var(--glass-border)' }} />

          {/* Module 2: Learning Center */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
              alignItems: 'start',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                Letters & Numbers Learning Center
              </h2>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                A focused interactive curriculum covering all 73 alphabet letters and numbers for ASL and FSL. Practice directly in front of your camera with instant AI posture validation.
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" style={{ marginTop: '3px' }} />
                  <div>
                    <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--text-primary)' }}>
                      73 Focused Sign Lessons
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Complete alphabets (A–Z) and numbers (0–9) with visual finger placement reference guides.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" style={{ marginTop: '3px' }} />
                  <div>
                    <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--text-primary)' }}>
                      Interactive Webcam Copying
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Hold your hand in camera view to verify your posture and automatically log mastered signs.
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-outline"
                onClick={() => setActiveTab('learning')}
                style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
              >
                Start Practice <ArrowRight className="w-3.5 h-3.5 ml-1 inline" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 3. Getting Started (Clean 3-Column Minimal Grid, No Boxed Cards) */}
      <section style={{ padding: '2.5rem 0', borderBottom: '1px solid var(--glass-border)' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          How It Works
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '2rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              01
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Select Language
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              Toggle between ASL and FSL directly in the Translator navigation bar or Settings.
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              02
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Enable Camera
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              Grant webcam permission when prompted. All landmark tracking runs entirely on your device.
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              03
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Translate & Learn
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              Use the studio for two-way conversations or the Learning Center to practice specific signs.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Footer Utility Row */}
      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingTop: '1.75rem',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Private & On-Device — camera video is processed locally and never leaves your browser.</span>
        </div>

        <button
          onClick={() => setActiveTab('settings')}
          className="btn btn-outline"
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </footer>
    </div>
  );
}
