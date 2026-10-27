import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LandingScroll } from '../src/components/common/LandingScroll';

const scroll = vi.hoisted(() => ({ create: vi.fn(), destroy: vi.fn() }));
vi.mock('lenis', () => ({ default: class {
  constructor(options: unknown) { scroll.create(options); }
  destroy() { scroll.destroy(); }
} }));
beforeEach(() => {
  scroll.create.mockClear(); scroll.destroy.mockClear();
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: !media.includes('prefers-reduced-motion: reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('enables landing smooth scroll and releases it when entering a room', async () => {
  const view = render(<LandingScroll enabled />);
  await waitFor(() => expect(scroll.create).toHaveBeenCalledOnce());
  view.rerender(<LandingScroll enabled={false} />);
  expect(scroll.destroy).toHaveBeenCalledOnce();
});

it('keeps native scrolling for reduced motion or coarse pointers', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<LandingScroll enabled />);
  await Promise.resolve();
  expect(scroll.create).not.toHaveBeenCalled();
});
