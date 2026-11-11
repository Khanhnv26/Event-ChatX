import { afterEach, expect, it, vi } from 'vitest';
import { activateNotificationSound, playNotificationSound } from '../src/services/notificationSound';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('unlocks audio on request and limits live sounds to one per two seconds', async () => {
  const start = vi.fn();
  const tone = { frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start, stop: vi.fn() };
  const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  tone.connect.mockReturnValue(gain);
  const context = { state: 'suspended', currentTime: 0, destination: {}, createOscillator: () => tone,
    createGain: () => gain, resume: async () => { context.state = 'running'; } };
  vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  const time = vi.spyOn(performance, 'now').mockReturnValue(0);
  playNotificationSound();
  expect(start).not.toHaveBeenCalled();
  expect(await activateNotificationSound()).toBe(true);
  playNotificationSound();
  time.mockReturnValue(1999);
  playNotificationSound();
  expect(start).toHaveBeenCalledOnce();
  time.mockReturnValue(2000);
  playNotificationSound();
  expect(start).toHaveBeenCalledTimes(2);
});
