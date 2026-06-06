import React from 'react';
import { audio } from '../utils/audio';

export default function DesktopIcon({ title, icon, isSelected, onClick, onDoubleClick }) {
  const handleSingleClick = (e) => {
    e.stopPropagation();
    audio.playClick();
    onClick();
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    onDoubleClick();
  };

  return (
    <div
      className={`desktop-icon ${isSelected ? 'selected' : ''}`}
      onClick={handleSingleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className="desktop-icon-img" style={{ fontSize: '26px' }}>
        {icon}
      </div>
      <div className="desktop-icon-text" style={{ fontFamily: 'var(--font-os)' }}>
        {title}
      </div>
    </div>
  );
}
