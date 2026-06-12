import { useState, useRef, useEffect } from 'react';
import { audio } from '../utils/audio';

// Controlled window chrome: position/size/stacking come from the window
// manager via `win`; this component only reports gestures back up.
export default function WindowFrame({
  win,
  isActive,
  zIndex,
  onClose,
  onFocus,
  onMove,
  onResize,
  onToggleMaximize,
  kiosk = false, // mobile: full-screen, no drag/resize/maximize
  children
}) {
  const [drag, setDrag] = useState(null); // { mode: 'move'|'resize' }
  const gestureRef = useRef(null); // { startX, startY, baseX, baseY, baseW, baseH }

  const beginGesture = (mode, e) => {
    if (win.isMaximized || kiosk) return;
    if (mode === 'move' && (e.target.tagName === 'BUTTON' || e.target.closest('button'))) {
      return;
    }
    onFocus();
    if (mode === 'move') audio.playClick();
    const pt = e.touches ? e.touches[0] : e;
    gestureRef.current = {
      startX: pt.clientX,
      startY: pt.clientY,
      baseX: win.x,
      baseY: win.y,
      baseW: win.width,
      baseH: win.height
    };
    setDrag({ mode });
  };
  const beginMove = (e) => beginGesture('move', e);
  const beginResize = (e) => beginGesture('resize', e);

  useEffect(() => {
    if (!drag) return;

    const apply = (clientX, clientY) => {
      const g = gestureRef.current;
      if (!g) return;
      if (drag.mode === 'move') {
        // Bounds check to keep title bar on screen
        const x = Math.max(0, Math.min(window.innerWidth - 100, g.baseX + clientX - g.startX));
        const y = Math.max(0, Math.min(window.innerHeight - 40, g.baseY + clientY - g.startY));
        onMove(x, y);
      } else {
        onResize(g.baseW + clientX - g.startX, g.baseH + clientY - g.startY);
      }
    };
    const handleMouseMove = (e) => apply(e.clientX, e.clientY);
    const handleTouchMove = (e) => apply(e.touches[0].clientX, e.touches[0].clientY);
    const handleUp = () => setDrag(null);

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
  }, [drag, onMove, onResize]);

  if (!win.isOpen || win.isMinimized) return null;

  const windowStyle = (win.isMaximized || kiosk)
    ? {
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex,
        display: 'flex',
        flexDirection: 'column'
      }
    : {
        left: `${win.x}px`,
        top: `${win.y}px`,
        width: `${win.width}px`,
        height: `${win.height}px`,
        zIndex,
        display: 'flex',
        flexDirection: 'column'
      };

  return (
    <div
      className="win95-window win95-raised"
      style={windowStyle}
      role="dialog"
      aria-label={win.title}
      onMouseDown={onFocus}
    >
      <div
        className={`win95-title-bar ${isActive ? 'active' : 'inactive'}`}
        onMouseDown={beginMove}
        onTouchStart={beginMove}
        onDoubleClick={() => {
          audio.playClick();
          onToggleMaximize();
        }}
      >
        <div className="win95-title-text" style={{ fontStyle: 'normal' }}>
          <span>{win.icon}</span>
          <span style={{ fontFamily: 'var(--font-os)', fontSize: '11px', letterSpacing: '0px' }}>{win.title}</span>
        </div>
        <div className="win95-title-controls" style={{ display: 'flex', gap: '2px' }}>
          {!kiosk && (
            <button
              className="win95-btn win95-title-btn"
              aria-label={win.isMaximized ? 'Restore window' : 'Maximize window'}
              onClick={(e) => {
                e.stopPropagation();
                audio.playClick();
                onToggleMaximize();
              }}
            >
              {win.isMaximized ? '❐' : '⬜'}
            </button>
          )}
          <button
            className="win95-btn win95-btn-close win95-title-btn"
            aria-label="Close window"
            style={{ fontWeight: 'bold' }}
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
      {!win.isMaximized && !kiosk && (
        <div
          className="win95-resize-grip"
          aria-hidden="true"
          onMouseDown={beginResize}
          onTouchStart={beginResize}
        />
      )}
    </div>
  );
}
