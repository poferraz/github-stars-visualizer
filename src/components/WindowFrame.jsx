import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!dragging) return;

    // Keep the title bar within the viewport for both mouse and touch drags.
    const move = ({ clientX, clientY }) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 100, clientX - dragStart.x)),
        y: Math.max(0, Math.min(window.innerHeight - 40, clientY - dragStart.y))
      });
    };
    const handleTouchMove = event => move(event.touches[0]);
    const endDrag = () => setDragging(false);

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchcancel', endDrag);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', endDrag);
      window.removeEventListener('touchcancel', endDrag);
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
