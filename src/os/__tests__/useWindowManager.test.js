import { describe, it, expect } from 'vitest';
import { windowsReducer, createInitialState, MIN_WIDTH, MIN_HEIGHT } from '../useWindowManager';

const DEFS = {
  help: { title: 'Help', icon: '?', defaultOpen: true, width: 400, height: 300 },
  settings: { title: 'Settings', icon: 'S', defaultOpen: true, width: 400, height: 300 },
  graph: { title: 'Graph', icon: 'G', defaultOpen: false, width: 600, height: 400, defaultMaximized: true }
};

const VIEWPORT = { width: 1024, height: 768 };

function topOf(state) {
  return state.order[state.order.length - 1];
}

describe('Window manager reducer', () => {
  it('initializes open windows into the stacking order, last definition on top', () => {
    const state = createInitialState(DEFS, VIEWPORT);
    expect(state.order).toEqual(['help', 'settings']);
    expect(state.windows.graph.isOpen).toBe(false);
    expect(state.windows.graph.isMaximized).toBe(true);
  });

  it('open raises the window to the top and unminimizes it', () => {
    let state = createInitialState(DEFS, VIEWPORT);
    state = windowsReducer(state, { type: 'open', id: 'graph' });
    expect(topOf(state)).toBe('graph');
    expect(state.windows.graph.isOpen).toBe(true);

    state = windowsReducer(state, { type: 'minimize', id: 'graph' });
    state = windowsReducer(state, { type: 'open', id: 'graph' });
    expect(state.windows.graph.isMinimized).toBe(false);
    expect(topOf(state)).toBe('graph');
  });

  it('close removes the window from the order; the next window becomes top', () => {
    let state = createInitialState(DEFS, VIEWPORT);
    state = windowsReducer(state, { type: 'close', id: 'settings' });
    expect(state.windows.settings.isOpen).toBe(false);
    expect(state.order).toEqual(['help']);
    expect(topOf(state)).toBe('help');
  });

  it('focus raises without reopening closed windows', () => {
    let state = createInitialState(DEFS, VIEWPORT);
    state = windowsReducer(state, { type: 'focus', id: 'help' });
    expect(topOf(state)).toBe('help');

    const before = windowsReducer(state, { type: 'focus', id: 'graph' }); // closed
    expect(before).toBe(state); // no-op
  });

  it('focus restores a minimized window', () => {
    let state = createInitialState(DEFS, VIEWPORT);
    state = windowsReducer(state, { type: 'minimize', id: 'settings' });
    expect(state.order).toEqual(['help']);
    state = windowsReducer(state, { type: 'focus', id: 'settings' });
    expect(state.windows.settings.isMinimized).toBe(false);
    expect(topOf(state)).toBe('settings');
  });

  it('toggle: closed→open, top→minimize, behind→focus, minimized→restore', () => {
    let state = createInitialState(DEFS, VIEWPORT);

    state = windowsReducer(state, { type: 'toggle', id: 'graph' }); // closed → open
    expect(topOf(state)).toBe('graph');

    state = windowsReducer(state, { type: 'toggle', id: 'graph' }); // top → minimize
    expect(state.windows.graph.isMinimized).toBe(true);

    state = windowsReducer(state, { type: 'toggle', id: 'graph' }); // minimized → restore
    expect(state.windows.graph.isMinimized).toBe(false);
    expect(topOf(state)).toBe('graph');

    state = windowsReducer(state, { type: 'toggle', id: 'help' }); // behind → focus
    expect(topOf(state)).toBe('help');
    expect(state.windows.graph.isOpen).toBe(true);
  });

  it('closeActive closes the top window only', () => {
    let state = createInitialState(DEFS, VIEWPORT);
    state = windowsReducer(state, { type: 'closeActive' });
    expect(state.windows.settings.isOpen).toBe(false);
    expect(state.windows.help.isOpen).toBe(true);
  });

  it('cycleFocus brings the bottom window to the top', () => {
    let state = createInitialState(DEFS, VIEWPORT);
    state = windowsReducer(state, { type: 'cycleFocus' });
    expect(state.order).toEqual(['settings', 'help']);
  });

  it('move stores position; resize clamps to minimum dimensions', () => {
    let state = createInitialState(DEFS, VIEWPORT);
    state = windowsReducer(state, { type: 'move', id: 'help', x: 5, y: 7 });
    expect(state.windows.help.x).toBe(5);
    expect(state.windows.help.y).toBe(7);

    state = windowsReducer(state, { type: 'resize', id: 'help', width: 10, height: 10 });
    expect(state.windows.help.width).toBe(MIN_WIDTH);
    expect(state.windows.help.height).toBe(MIN_HEIGHT);
  });

  it('toggleMaximize flips the flag and raises the window', () => {
    let state = createInitialState(DEFS, VIEWPORT);
    state = windowsReducer(state, { type: 'toggleMaximize', id: 'help' });
    expect(state.windows.help.isMaximized).toBe(true);
    expect(topOf(state)).toBe('help');
  });

  it('hydrates saved geometry, clamping junk back into the viewport', () => {
    const saved = {
      help: { x: 99999, y: -50, width: 350, height: 320, isMaximized: false },
      settings: { x: 'NaN', width: 5 } // garbage: ignored / clamped
    };
    const state = createInitialState(DEFS, VIEWPORT, saved);

    expect(state.windows.help.x).toBeLessThanOrEqual(VIEWPORT.width - 100);
    expect(state.windows.help.y).toBe(0);
    expect(state.windows.help.width).toBe(350);

    expect(Number.isFinite(state.windows.settings.x)).toBe(true);
    expect(state.windows.settings.width).toBe(MIN_WIDTH); // 5 clamped up
  });

  it('actions on unknown window ids are no-ops', () => {
    const state = createInitialState(DEFS, VIEWPORT);
    expect(windowsReducer(state, { type: 'open', id: 'nope' })).toBe(state);
    expect(windowsReducer(state, { type: 'move', id: 'nope', x: 1, y: 1 })).toBe(state);
  });
});
