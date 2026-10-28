import React, { useState, useEffect } from 'react';
import { useModel } from '../contexts/ModelContext';
import logoImg from '../assets/Logo_1.jpg';

/**
 * ModelLoadingOverlay — Displays an animated full-screen loading overlay
 * with real-time download progress while the quantized GRU is initialized.
 *
 * Uses Logo_1.jpg as the official branding emblem.
 * Gracefully fades out once model download & calibration are complete.
 */
export default function ModelLoadingOverlay() {
  const {
    isModelLoaded,
    loadingProgress,
    loadedBytes,
    totalBytes,
    loadingStage,
    loadingError,
    retryLoading,
  } = useModel();

  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isUnmounted, setIsUnmounted] = useState(false);

  // Smooth fade-out transition when loading finishes
  useEffect(() => {
    if (isModelLoaded) {
      setIsFadingOut(true);
      const timer = setTimeout(() => setIsUnmounted(true), 380);
      return () => clearTimeout(timer);
    }
  }, [isModelLoaded]);

  if (isUnmounted) return null;

  const loadedMB = (loadedBytes / (1024 * 1024)).toFixed(1);
  const totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '...';
  const progressClamped = Math.min(100, Math.max(0, loadingProgress));

  return (
    <div className={`model-loading-overlay ${isFadingOut ? 'model-loading-fade-out' : ''}`}>
      <div className="model-loading-content">
        {/* Animated Brand Logo with Ambient Glow */}
        <div className="model-loading-icon-wrapper">
          <img src={logoImg} alt="SignSync Logo" className="model-loading-logo" />
        </div>

        <h2 className="model-loading-title">Initializing SignSync</h2>

        <p className="model-loading-stage">{loadingStage}</p>

        {/* Progress Bar Track & Fill */}
        <div className="model-loading-bar-track">
          <div
            className="model-loading-bar-fill"
            style={{ width: `${progressClamped}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="model-loading-stats">
          <span className="model-loading-percent">{progressClamped}%</span>
          <span className="model-loading-bytes">{loadedMB} / {totalMB} MB</span>
        </div>

        {loadingError && (
          <>
            <p className="model-loading-error">⚠ {loadingError}</p>
            <button type="button" className="model-loading-skip-btn" onClick={retryLoading}>
              Retry recognition models
            </button>
          </>
        )}

        <p className="model-loading-hint">
          AI models run entirely on your device. No video or data leaves your browser.
        </p>

      </div>
    </div>
  );
}
