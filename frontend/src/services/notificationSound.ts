export const NOTIFICATION_SOUND_KEY = 'eventchat_notification_sound';
const SOUND_INTERVAL_MS = 2000;
let context: AudioContext | undefined;
let lastPlayedAt = -Infinity;

export function readNotificationSound(): boolean {
  try { return localStorage.getItem(NOTIFICATION_SOUND_KEY) === 'on'; }
  catch { return false; }
}

export function saveNotificationSound(enabled: boolean) {
  try { localStorage.setItem(NOTIFICATION_SOUND_KEY, enabled ? 'on' : 'off'); }
  catch { return; }
}

function play(audio: AudioContext) {
  const now = audio.currentTime;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(660, now);
  tone.frequency.setValueAtTime(880, now + 0.095);
  volume.gain.setValueAtTime(0.001, now);
  volume.gain.exponentialRampToValueAtTime(0.075, now + 0.025);
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
  tone.connect(volume).connect(audio.destination);
  tone.onended = () => { tone.disconnect(); volume.disconnect(); };
  tone.start(now);
  tone.stop(now + 0.25);
}

export async function activateNotificationSound(preview = false): Promise<boolean> {
  try {
    context ??= new AudioContext();
    if (context.state !== 'running') await context.resume();
    if (context.state !== 'running') return false;
    if (preview) play(context);
    return true;
  } catch {
    return false;
  }
}

export function playNotificationSound() {
  if (context?.state !== 'running' || performance.now() - lastPlayedAt < SOUND_INTERVAL_MS) return;
  lastPlayedAt = performance.now();
  play(context);
}
