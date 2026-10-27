import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { isMotionEnabled } from '../src/services/motionPreference';

vi.mock('../src/routes/LandingPage', () => ({ LandingPage: () => <p>Home</p> }));
vi.mock('../src/mockup/components/InteractiveBackground', () => ({ InteractiveBackground: () => null }));
vi.mock('../src/components/common/LandingScroll', () => ({ LandingScroll: () => null }));
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.motion;
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: media.includes('prefers-reduced-motion: reduce'),
    addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup(); localStorage.clear(); delete document.documentElement.dataset.motion;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('respects the system default until the user chooses full motion and saves that choice', () => {
  render(<App />);
  expect(isMotionEnabled()).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Bật hiệu ứng chuyển động' }));
  expect(isMotionEnabled()).toBe(true);
  expect(localStorage.getItem('eventchat_motion')).toBe('full');
  fireEvent.click(screen.getByRole('button', { name: 'Tắt hiệu ứng chuyển động' }));
  expect(isMotionEnabled()).toBe(false);
  expect(localStorage.getItem('eventchat_motion')).toBe('reduced');
});

it('restores an explicit full-motion preference even if the system prefers reduced motion', () => {
  localStorage.setItem('eventchat_motion', 'full');
  render(<App />);
  expect(isMotionEnabled()).toBe(true);
  expect(screen.getByRole('button', { name: 'Tắt hiệu ứng chuyển động' })).toBeTruthy();
});

it('synchronizes the preference when changed in another EventChat tab', () => {
  render(<App />);
  expect(isMotionEnabled()).toBe(false);
  fireEvent(window, new StorageEvent('storage', { key: 'eventchat_motion', newValue: 'full' }));
  expect(isMotionEnabled()).toBe(true);
});
