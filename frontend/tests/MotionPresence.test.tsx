import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MotionPresence } from '../src/components/common/MotionPresence';
import { ChatMessageList } from '../src/mockup/components/ChatMessageList';
import type { ChatMessage } from '../src/mockup/types';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('keeps a closing surface mounted and inert until its exit finishes', () => {
  const view = render(<MotionPresence open><button>Panel</button></MotionPresence>);
  view.rerender(<MotionPresence open={false}><button>Panel</button></MotionPresence>);
  const surface = screen.getByText('Panel').parentElement!;
  expect(surface.dataset.state).toBe('closed');
  expect(surface.hasAttribute('inert')).toBe(true);
  act(() => { vi.advanceTimersByTime(279); });
  expect(screen.getByText('Panel')).toBeTruthy();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.queryByText('Panel')).toBeNull();
});

it('cancels an exit if the surface is reopened quickly', () => {
  const view = render(<MotionPresence open><button>Panel</button></MotionPresence>);
  view.rerender(<MotionPresence open={false}><button>Panel</button></MotionPresence>);
  act(() => { vi.advanceTimersByTime(100); });
  view.rerender(<MotionPresence open><button>Panel</button></MotionPresence>);
  act(() => { vi.advanceTimersByTime(400); });
  expect(screen.getByText('Panel').parentElement?.dataset.state).toBe('open');
  expect(screen.getByText('Panel').parentElement?.hasAttribute('inert')).toBe(false);
});

it('does not retain an exit delay for reduced motion', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  const view = render(<MotionPresence open><button>Panel</button></MotionPresence>);
  view.rerender(<MotionPresence open={false}><button>Panel</button></MotionPresence>);
  act(() => { vi.advanceTimersByTime(0); });
  expect(screen.queryByText('Panel')).toBeNull();
});

it('preserves the message DOM across server acknowledgement so entrance does not replay', () => {
  const message: ChatMessage = { id: 'client-id', clientMessageId: 'client-id', senderId: 'me', senderName: 'Me',
    senderRole: 'HOST', avatarColor: '#6366f1', content: 'Hello', createdAt: '10:00', isMe: true };
  const open = vi.fn();
  const view = render(<ChatMessageList messages={[message]} onOpenDecisions={open} />);
  const original = view.container.querySelector('[data-message-id="client-id"]');
  view.rerender(<ChatMessageList messages={[{ ...message, id: 'server-id' }]} onOpenDecisions={open} />);
  expect(view.container.querySelector('[data-message-id="server-id"]')).toBe(original);
});
