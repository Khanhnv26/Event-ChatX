import React, { Profiler } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LandingView } from '../src/mockup/components/LandingView';
import { PreloaderProvider } from '../src/components/common/PreloaderContext';

let frames: Map<number, FrameRequestCallback>;
let frameId: number;
beforeEach(() => {
  frames = new Map();
  frameId = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ media,
    matches: !media.includes('prefers-reduced-motion: reduce'),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function flushFrames() {
  for (let tick = 0; tick < 250 && frames.size; tick++) {
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach(callback => callback(tick * 16)));
  }
}

it('does not rerender the landing forms for pointer animation and stops when settled', () => {
  const renderCommit = vi.fn();
  render(<Profiler id="landing" onRender={renderCommit}><LandingView onEnterRoom={vi.fn()} /></Profiler>);
  const initialCommits = renderCommit.mock.calls.length;
  fireEvent(window, new MouseEvent('pointermove', { clientX: 800, clientY: 400 }));
  flushFrames();
  expect(renderCommit).toHaveBeenCalledTimes(initialCommits);
  expect(frames.size).toBe(0);
});

it('shows the requested fullscreen startup animation before revealing content', () => {
  vi.useFakeTimers();
  render(<PreloaderProvider><button>Vào phòng</button></PreloaderProvider>);
  expect(screen.getByRole('status', { name: 'Đang tải' }).className).toContain('fixed inset-0');
  act(() => { vi.advanceTimersByTime(1499); });
  expect(screen.getByText('Bàn nhanh. Chốt rõ.')).toBeTruthy();
  act(() => { vi.advanceTimersByTime(1); });
  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.queryByText('Bàn nhanh. Chốt rõ.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Vào phòng' })).toBeTruthy();
  vi.useRealTimers();
});

it('does not schedule pointer animation when the user prefers reduced motion', () => {
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ media, matches: false,
    addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<LandingView onEnterRoom={vi.fn()} />);
  fireEvent(window, new MouseEvent('pointermove', { clientX: 800, clientY: 400 }));
  expect(frames.size).toBe(0);
});

it('keeps parallax active in a narrow desktop tab when full motion is selected', () => {
  document.documentElement.dataset.motion = 'full';
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ media,
    matches: !media.includes('min-width'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const view = render(<LandingView onEnterRoom={vi.fn()} />);
  fireEvent(window, new MouseEvent('pointermove', { clientX: 800, clientY: 400 }));
  expect(frames.size).toBeGreaterThan(0);
  flushFrames();
  expect(view.container.querySelector<HTMLElement>('[data-parallax-x]')?.style.transform).toContain('translate3d(');
  delete document.documentElement.dataset.motion;
});
