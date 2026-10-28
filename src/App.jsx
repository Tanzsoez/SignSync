import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import { ModelProvider, useModel } from './contexts/ModelContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const VALID_TABS = ['home', 'translator', 'learning', 'settings'];
const TranslatorPage = lazy(() => import('./pages/TranslatorPage'));
const LearningCenterPage = lazy(() => import('./pages/LearningCenterPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ModelLoadingOverlay = lazy(() => import('./components/ModelLoadingOverlay'));

function getTabFromHash() {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  return VALID_TABS.includes(hash) ? hash : 'home';
}

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => getTabFromHash());
  const { loadModels, hasStartedLoading } = useModel();

  useEffect(() => {
    const startLoading = () => void loadModels().catch(() => {});
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(startLoading, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(startLoading, 250);
    return () => window.clearTimeout(timer);
  }, [loadModels]);

  // Sync hash → state on browser back/forward
  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Sync state → hash on tab change
  const handleSetActiveTab = useCallback((tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('signsync_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <div className="app-container">
        {/* Shared Model Loading Overlay — Displays on initial AI model download & calibration */}
        {hasStartedLoading && <Suspense fallback={null}><ModelLoadingOverlay /></Suspense>}

        {/* Sidebar Navigation */}
        <Sidebar activeTab={activeTab} setActiveTab={handleSetActiveTab} />

        {/* Main Viewport Content with ErrorBoundary protection */}
        <main className="main-content">
          <ErrorBoundary>
            {activeTab === 'home' && <HomePage setActiveTab={handleSetActiveTab} />}
            <Suspense fallback={<div style={{ padding: '2rem' }}>Loading workspace...</div>}>
              {activeTab === 'translator' && <TranslatorPage />}
              {activeTab === 'learning' && <LearningCenterPage />}
            </Suspense>
            <Suspense fallback={<div className="route-loading">Loading settings...</div>}>
              {activeTab === 'settings' && <SettingsPage />}
            </Suspense>
          </ErrorBoundary>
        </main>
    </div>
  );
}

export default function App() {
  return <ModelProvider><AppContent /></ModelProvider>;
}
