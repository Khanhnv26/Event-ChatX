import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Preloader } from '../src/components/common/Preloader';
import { PreloaderProvider, useLoadingOverlay } from '../src/components/common/PreloaderContext';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('keeps a fast load visible for 1.5 seconds before a 300ms exit', () => {
  const view = render(<Preloader isLoading />);
  act(() => { vi.advanceTimersByTime(50); });
  view.rerender(<Preloader isLoading={false} />);
  act(() => { vi.advanceTimersByTime(1449); });
  expect(screen.getByRole('status').className).toContain('opacity-100');
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.getByRole('status').className).toContain('opacity-0');
  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.queryByRole('status')).toBeNull();
});

it('remains fullscreen for a slow request until loading finishes', () => {
  const view = render(<Preloader isLoading />);
  act(() => { vi.advanceTimersByTime(4000); });
  expect(screen.getByRole('status').className).toContain('fixed inset-0');
  view.rerender(<Preloader isLoading={false} />);
  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.queryByRole('status')).toBeNull();
});

function Pending({ loading }: { loading: boolean }) { useLoadingOverlay(loading); return null; }
it('uses one overlay across overlapping page loads without hiding early', () => {
  const view = render(<PreloaderProvider><Pending loading /><Pending loading /></PreloaderProvider>);
  act(() => { vi.advanceTimersByTime(2000); });
  view.rerender(<PreloaderProvider><Pending loading={false} /><Pending loading /></PreloaderProvider>);
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status').className).toContain('opacity-100');
  view.rerender(<PreloaderProvider><Pending loading={false} /><Pending loading={false} /></PreloaderProvider>);
  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.queryByRole('status')).toBeNull();
});
