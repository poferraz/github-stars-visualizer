import React, { useState, useEffect } from 'react';
import { audio } from '../utils/audio';

export default function Taskbar({ 
  windows, 
  onToggleWindow, 
  onFocusWindow, 
  crtEnabled, 
  onToggleCrt, 
  onShutdown,
  onResetAll 
}) {
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  // 1. Live system clock
  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour '0' should be '12'
      setTimeStr(`${hours}:${minutes} ${ampm}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStartClick = () => {
    audio.playClick();
    setStartMenuOpen(!startMenuOpen);
  };

  const handleStartItemClick = (action) => {
    audio.playClick();
    setStartMenuOpen(false);
    action();
  };

  // Close start menu when clicking anywhere on desktop
  useEffect(() => {
    const handleOutsideClick = () => {
      setStartMenuOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div className="taskbar" onClick={(e) => e.stopPropagation()}>
      
      {/* 1. Start Button & Menu */}
      <div style={{ position: 'relative' }}>
        <button 
          className="win95-btn start-button" 
          onClick={handleStartClick}
          style={{ 
            fontStyle: 'normal',
            borderStyle: startMenuOpen ? 'inset' : 'outset',
            borderColor: startMenuOpen 
              ? 'var(--os-shadow) var(--os-light) var(--os-light) var(--os-shadow)' 
              : 'var(--os-light) var(--os-shadow) var(--os-shadow) var(--os-light)'
          }}
        >
          <span style={{ fontSize: '15px' }}>📁</span>
          <span>Start</span>
        </button>

        {startMenuOpen && (
          <div className="start-menu">
            <div className="start-menu-sidebar">
              <span>GitStars Map v1.0</span>
            </div>
            <div className="start-menu-items">
              <div 
                className="start-menu-item"
                onClick={() => handleStartItemClick(() => onToggleWindow('settings'))}
              >
                ⚙️ API Settings
              </div>
              <div 
                className="start-menu-item"
                onClick={() => handleStartItemClick(() => onToggleWindow('help'))}
              >
                ❓ Help Manual
              </div>
              <div 
                className="start-menu-item"
                onClick={() => handleStartItemClick(() => onToggleWindow('graph'))}
              >
                🕸️ Stars Map
              </div>
              <div 
                className="start-menu-item"
                onClick={() => handleStartItemClick(() => onToggleWindow('detail'))}
              >
                🔍 Node Properties
              </div>
              <div className="start-menu-divider" />
              <div 
                className="start-menu-item"
                onClick={() => handleStartItemClick(() => {
                  if (window.confirm('WARNING: This will delete all cached stars and local API tokens. Continue?')) {
                    onResetAll();
                  }
                })}
              >
                🗑️ Format Cache & Keys
              </div>
              <div className="start-menu-divider" />
              <div 
                className="start-menu-item"
                onClick={() => handleStartItemClick(onShutdown)}
              >
                🔘 Shut Down...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Active Window Tabs */}
      <div className="taskbar-tabs">
        {Object.entries(windows).map(([id, win]) => {
          if (!win.isOpen) return null;
          return (
            <button
              key={id}
              className={`win95-btn taskbar-tab ${win.isActive ? 'active' : ''}`}
              onClick={() => {
                audio.playClick();
                if (win.isActive) {
                  // Minimize if active
                  onToggleWindow(id);
                } else {
                  // Focus if open but background
                  onFocusWindow(id);
                }
              }}
            >
              {win.icon} {win.title}
            </button>
          );
        })}
      </div>

      {/* 3. System Tray */}
      <div className="taskbar-clock win95-recessed" style={{ gap: '10px' }}>
        {/* CRT toggle */}
        <button 
          className="win95-btn"
          style={{ 
            fontSize: '10px', 
            padding: '1px 4px', 
            height: '20px',
            borderStyle: crtEnabled ? 'inset' : 'outset'
          }} 
          onClick={onToggleCrt}
        >
          📺 CRT: {crtEnabled ? 'ON' : 'OFF'}
        </button>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{timeStr}</span>
      </div>

    </div>
  );
}
