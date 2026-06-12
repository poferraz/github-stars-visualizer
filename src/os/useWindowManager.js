import { useReducer, useEffect, useMemo, useCallback } from 'react';
import { storage } from '../services/storage';

// Single source of truth for window position, size, stacking and visibility.
// Stacking is an ordered list (bottom → top): z-index and the active window
// are derived from it, so there are no competing z counters anywhere else.

const BASE_Z = 10;
export const MIN_WIDTH = 280;
export const MIN_HEIGHT = 160;

function clampPosition(x, y, viewport) {
  // Keep at least part of the title bar reachable
  return {
    x: Math.max(0, Math.min(viewport.width - 100, x)),
    y: Math.max(0, Math.min(viewport.height - 40, y))
  };
}

export function createInitialState(definitions, viewport, savedLayout = {}) {
  const windows = {};
  const order = [];

  Object.entries(definitions).forEach(([id, def]) => {
    const saved = savedLayout && typeof savedLayout === 'object' ? savedLayout[id] : null;

    const width = Number.isFinite(saved?.width) ? Math.max(MIN_WIDTH, saved.width) : def.width;
    const height = Number.isFinite(saved?.height) ? Math.max(MIN_HEIGHT, saved.height) : def.height;

    const defaultX = Math.max(10, Math.round((viewport.width - width) / 2) + (def.offsetX || 0));
    const defaultY = Math.max(10, Math.round((viewport.height - height) / 2) + (def.offsetY || 0));
    const pos = clampPosition(
      Number.isFinite(saved?.x) ? saved.x : defaultX,
      Number.isFinite(saved?.y) ? saved.y : defaultY,
      viewport
    );

    windows[id] = {
      id,
      title: def.title,
      icon: def.icon,
      isOpen: !!def.defaultOpen,
      isMinimized: false,
      isMaximized: typeof saved?.isMaximized === 'boolean' ? saved.isMaximized : !!def.defaultMaximized,
      x: pos.x,
      y: pos.y,
      width,
      height
    };

    if (windows[id].isOpen) order.push(id);
  });

  return { windows, order };
}

function withWindow(state, id, patch) {
  return { ...state.windows, [id]: { ...state.windows[id], ...patch } };
}

function raised(order, id) {
  return [...order.filter((w) => w !== id), id];
}

export function windowsReducer(state, action) {
  const win = action.id ? state.windows[action.id] : null;

  switch (action.type) {
    case 'open': {
      if (!win) return state;
      return {
        order: raised(state.order, action.id),
        windows: withWindow(state, action.id, { isOpen: true, isMinimized: false })
      };
    }

    case 'close': {
      if (!win) return state;
      return {
        order: state.order.filter((w) => w !== action.id),
        windows: withWindow(state, action.id, { isOpen: false, isMinimized: false })
      };
    }

    case 'closeActive': {
      const top = state.order[state.order.length - 1];
      return top ? windowsReducer(state, { type: 'close', id: top }) : state;
    }

    case 'focus': {
      // Also restores a minimized window — a focused window must be visible
      if (!win || !win.isOpen) return state;
      if (!win.isMinimized && state.order[state.order.length - 1] === action.id) return state;
      return {
        order: raised(state.order, action.id),
        windows: win.isMinimized
          ? withWindow(state, action.id, { isMinimized: false })
          : state.windows
      };
    }

    case 'cycleFocus': {
      // Bring the bottom-most visible window to the top (F6)
      if (state.order.length < 2) return state;
      return windowsReducer(state, { type: 'focus', id: state.order[0] });
    }

    case 'minimize': {
      if (!win || !win.isOpen || win.isMinimized) return state;
      return {
        order: state.order.filter((w) => w !== action.id),
        windows: withWindow(state, action.id, { isMinimized: true })
      };
    }

    case 'toggle': {
      // Desktop icon / start menu / taskbar tab semantics:
      // closed → open+focus; minimized → restore+focus;
      // open on top → minimize; open behind → focus
      if (!win) return state;
      if (!win.isOpen) return windowsReducer(state, { type: 'open', id: action.id });
      if (win.isMinimized) return windowsReducer(state, { type: 'focus', id: action.id });
      if (state.order[state.order.length - 1] === action.id) {
        return windowsReducer(state, { type: 'minimize', id: action.id });
      }
      return windowsReducer(state, { type: 'focus', id: action.id });
    }

    case 'move': {
      if (!win) return state;
      return { ...state, windows: withWindow(state, action.id, { x: action.x, y: action.y }) };
    }

    case 'resize': {
      if (!win) return state;
      return {
        ...state,
        windows: withWindow(state, action.id, {
          width: Math.max(MIN_WIDTH, action.width),
          height: Math.max(MIN_HEIGHT, action.height)
        })
      };
    }

    case 'toggleMaximize': {
      if (!win) return state;
      return {
        order: raised(state.order, action.id),
        windows: withWindow(state, action.id, { isMaximized: !win.isMaximized })
      };
    }

    default:
      return state;
  }
}

export function useWindowManager(definitions) {
  const [state, dispatch] = useReducer(windowsReducer, undefined, () => {
    const viewport = typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1024, height: 768 };
    const saved = storage.read('layout', {}, (v) => v && typeof v === 'object' && !Array.isArray(v));
    return createInitialState(definitions, viewport, saved);
  });

  // Persist geometry (debounced — `move` fires per pointer event)
  useEffect(() => {
    const t = setTimeout(() => {
      const layout = {};
      Object.entries(state.windows).forEach(([id, w]) => {
        layout[id] = { x: w.x, y: w.y, width: w.width, height: w.height, isMaximized: w.isMaximized };
      });
      storage.write('layout', layout);
    }, 400);
    return () => clearTimeout(t);
  }, [state.windows]);

  // Keyboard: Esc closes the active window, F6 cycles window focus.
  // Ignored while typing so Esc keeps its native meaning in form fields.
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        dispatch({ type: 'closeActive' });
      } else if (e.key === 'F6') {
        e.preventDefault();
        dispatch({ type: 'cycleFocus' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeId = state.order[state.order.length - 1] ?? null;

  // View model: window objects enriched with derived isActive / zIndex
  const windows = useMemo(() => {
    const out = {};
    Object.entries(state.windows).forEach(([id, w]) => {
      const stackIndex = state.order.indexOf(id);
      out[id] = {
        ...w,
        isActive: id === activeId && w.isOpen && !w.isMinimized,
        zIndex: stackIndex === -1 ? BASE_Z : BASE_Z + stackIndex
      };
    });
    return out;
  }, [state, activeId]);

  const open = useCallback((id) => dispatch({ type: 'open', id }), []);
  const close = useCallback((id) => dispatch({ type: 'close', id }), []);
  const toggle = useCallback((id) => dispatch({ type: 'toggle', id }), []);
  const focus = useCallback((id) => dispatch({ type: 'focus', id }), []);
  const minimize = useCallback((id) => dispatch({ type: 'minimize', id }), []);
  const move = useCallback((id, x, y) => dispatch({ type: 'move', id, x, y }), []);
  const resize = useCallback((id, width, height) => dispatch({ type: 'resize', id, width, height }), []);
  const toggleMaximize = useCallback((id) => dispatch({ type: 'toggleMaximize', id }), []);

  return { windows, activeId, open, close, toggle, focus, minimize, move, resize, toggleMaximize };
}
