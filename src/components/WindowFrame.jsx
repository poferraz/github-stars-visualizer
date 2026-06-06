import React, { useState, useRef, useEffect } from 'react';
import { audio } from '../utils/audio';

export default function WindowFrame({
  id,
  title,
  isOpen,
  onClose,
  onFocus,
  isActive,
  zIndex,
  defaultX = 100,
  defaultY = 100,
  width = '400px',
  height = 'auto',
  minHeight = 'auto',
  children,
  icon = '📁'
}) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const headerRef = useRef(null);

  const handleMouseDown = (e) => {
    // Avoid dragging when clicking control buttons
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return;
    }
    onFocus();
    audio.playClick();
    setDragging(true);
    setDragStart({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    // Bounds check to keep title bar on screen
    const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragStart.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragStart.y));
    
    setPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  // Add touch support for mobile drag-and-drop
  const handleTouchStart = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    const touch = e.touches[0];
    onFocus();
    audio.playClick();
    setDragging(true);
    setDragStart({
      x: touch.clientX - pos.x,
      y: touch.clientY - pos.y
    });
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    const touch = e.touches[0];
    const newX = Math.max(0, Math.min(window.innerWidth - 100, touch.clientX - dragStart.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 40, touch.clientY - dragStart.y));
    setPos({ x: newX, y: newY });
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [dragging, dragStart]);

  if (!isOpen) return null;

  return (
    <div
      className="win95-window win95-raised"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: width,
        height: height,
        minHeight: minHeight,
        zIndex: zIndex,
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={onFocus}
    >
      <div
        ref={headerRef}
        className={`win95-title-bar ${isActive ? 'active' : 'inactive'}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="win95-title-text" style={{ fontStyle: 'normal' }}>
          <span>{icon}</span>
          <span style={{ fontFamily: 'var(--font-os)', fontSize: '11px', letterSpacing: '0px' }}>{title}</span>
        </div>
        <div className="win95-title-controls">
          <button
            className="win95-btn win95-btn-close"
            style={{ width: '16px', height: '14px', fontSize: '9px', fontWeight: 'bold' }}
            onClick={(e) => {
              e.stopPropagation();
              audio.playClick();
              onClose();
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
