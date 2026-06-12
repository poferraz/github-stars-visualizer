import { useState, useRef, useEffect } from 'react';
import { audio } from '../utils/audio';

export default function WindowFrame({
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
  icon = '📁',
  defaultMaximized = false
}) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [isMaximized, setIsMaximized] = useState(defaultMaximized);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const headerRef = useRef(null);

  const handleMouseDown = (e) => {
    if (isMaximized) return;
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

  // Add touch support for mobile drag-and-drop
  const handleTouchStart = (e) => {
    if (isMaximized) return;
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

  // Move/up handlers live inside the effect so listener identity and the
  // dragStart they close over always match the current drag session
  useEffect(() => {
    if (!dragging) return;

    const moveTo = (clientX, clientY) => {
      // Bounds check to keep title bar on screen
      const newX = Math.max(0, Math.min(window.innerWidth - 100, clientX - dragStart.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 40, clientY - dragStart.y));
      setPos({ x: newX, y: newY });
    };
    const handleMouseMove = (e) => moveTo(e.clientX, e.clientY);
    const handleTouchMove = (e) => moveTo(e.touches[0].clientX, e.touches[0].clientY);
    const handleUp = () => setDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, dragStart]);

  if (!isOpen) return null;

  const windowStyle = isMaximized
    ? {
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex,
        display: 'flex',
        flexDirection: 'column'
      }
    : {
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: width,
        height: height,
        minHeight: minHeight,
        zIndex: zIndex,
        display: 'flex',
        flexDirection: 'column'
      };

  return (
    <div
      className="win95-window win95-raised"
      style={windowStyle}
      onClick={onFocus}
    >
      <div
        ref={headerRef}
        className={`win95-title-bar ${isActive ? 'active' : 'inactive'}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={() => {
          audio.playClick();
          setIsMaximized(!isMaximized);
        }}
      >
        <div className="win95-title-text" style={{ fontStyle: 'normal' }}>
          <span>{icon}</span>
          <span style={{ fontFamily: 'var(--font-os)', fontSize: '11px', letterSpacing: '0px' }}>{title}</span>
        </div>
        <div className="win95-title-controls" style={{ display: 'flex', gap: '2px' }}>
          <button
            className="win95-btn"
            style={{ width: '16px', height: '14px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => {
              e.stopPropagation();
              audio.playClick();
              setIsMaximized(!isMaximized);
            }}
          >
            {isMaximized ? '❐' : '⬜'}
          </button>
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
