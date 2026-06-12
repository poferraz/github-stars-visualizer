import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import WindowFrame from '../WindowFrame';

vi.mock('../../utils/audio', () => ({
  audio: { playClick: vi.fn(), playSuccess: vi.fn(), playError: vi.fn(), playFloppySeek: vi.fn() }
}));

function makeWin(overrides = {}) {
  return {
    id: 'help',
    title: 'Help Manual',
    icon: '❓',
    isOpen: true,
    isMinimized: false,
    isMaximized: false,
    x: 100,
    y: 80,
    width: 400,
    height: 300,
    ...overrides
  };
}

function renderFrame(win, handlers = {}) {
  const props = {
    win,
    isActive: true,
    zIndex: 12,
    onClose: vi.fn(),
    onFocus: vi.fn(),
    onMove: vi.fn(),
    onResize: vi.fn(),
    onToggleMaximize: vi.fn(),
    ...handlers
  };
  const utils = render(
    <WindowFrame {...props}>
      <div>content</div>
    </WindowFrame>
  );
  return { ...utils, props };
}

describe('WindowFrame (controlled)', () => {
  afterEach(cleanup);

  it('renders a dialog with the window title and controlled geometry', () => {
    renderFrame(makeWin());
    const dialog = screen.getByRole('dialog', { name: 'Help Manual' });
    expect(dialog.style.left).toBe('100px');
    expect(dialog.style.width).toBe('400px');
    expect(dialog.style.zIndex).toBe('12');
  });

  it('renders nothing when closed or minimized', () => {
    renderFrame(makeWin({ isOpen: false }));
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    renderFrame(makeWin({ isMinimized: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('invokes onClose / onToggleMaximize from the title bar controls', () => {
    const { props } = renderFrame(makeWin());
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Maximize window' }));
    expect(props.onToggleMaximize).toHaveBeenCalledTimes(1);
  });

  it('reports drag movement through onMove with the position delta', () => {
    const { props } = renderFrame(makeWin());
    const titleBar = screen.getByText('Help Manual').closest('.win95-title-bar');

    fireEvent.mouseDown(titleBar, { clientX: 200, clientY: 150 });
    fireEvent.mouseMove(window, { clientX: 230, clientY: 170 });
    expect(props.onMove).toHaveBeenLastCalledWith(130, 100); // base 100/80 + delta 30/20
    fireEvent.mouseUp(window);

    props.onMove.mockClear();
    fireEvent.mouseMove(window, { clientX: 300, clientY: 300 });
    expect(props.onMove).not.toHaveBeenCalled(); // drag session ended
  });

  it('reports resize gestures through onResize', () => {
    const { props } = renderFrame(makeWin());
    const grip = document.querySelector('.win95-resize-grip');

    fireEvent.mouseDown(grip, { clientX: 500, clientY: 380 });
    fireEvent.mouseMove(window, { clientX: 540, clientY: 410 });
    expect(props.onResize).toHaveBeenLastCalledWith(440, 330); // base 400/300 + delta 40/30
    fireEvent.mouseUp(window);
  });

  it('maximized windows ignore drag and hide the resize grip', () => {
    const { props } = renderFrame(makeWin({ isMaximized: true }));
    expect(document.querySelector('.win95-resize-grip')).toBeNull();

    const titleBar = screen.getByText('Help Manual').closest('.win95-title-bar');
    fireEvent.mouseDown(titleBar, { clientX: 200, clientY: 150 });
    fireEvent.mouseMove(window, { clientX: 230, clientY: 170 });
    expect(props.onMove).not.toHaveBeenCalled();
  });
});
