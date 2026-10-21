import React from 'react';
import { Home, GraduationCap, Settings } from 'lucide-react';
import IlyHandIcon from './IlyHandIcon';
import logoImg from '../assets/Logo_1.jpg';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'translator', label: 'Translator', icon: IlyHandIcon, badge: 'Active' },
    { id: 'learning', label: 'Learning Center', icon: GraduationCap },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* 1. DESKTOP SIDEBAR (Visible on screens > 768px) */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-logo">
          <img
            src={logoImg}
            alt="SignSync Logo"
            className="logo-icon"
          />
          <div className="logo-text">
            Sign<span style={{ color: 'var(--accent-primary)' }}>Sync</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="nav-icon" />
                <span className="nav-text">{item.label}</span>
                {item.badge && (
                  <span
                    className="badge badge-blue"
                    style={{ marginLeft: 'auto', fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

      </aside>

      {/* 2. MOBILE TOP HEADER (Visible on screens <= 768px) */}
      <header className="mobile-header mobile-only">
        <div className="sidebar-logo" style={{ margin: 0 }}>
          <img
            src={logoImg}
            alt="SignSync Logo"
            className="logo-icon"
          />
          <div className="logo-text">
            Sign<span style={{ color: 'var(--accent-primary)' }}>Sync</span>
          </div>
        </div>
        <div className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
          Mobile Edition
        </div>
      </header>

      {/* 3. MOBILE BOTTOM NAVIGATION BAR (Visible on screens <= 768px) */}
      <nav className="mobile-bottom-nav mobile-only">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="mobile-nav-icon" />
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
