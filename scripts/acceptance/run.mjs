// Run only against a disposable rehearsal stack: this creates a room and writes test data.
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
const base = process.env.EVENTCHAT_ACCEPTANCE_URL || 'http://localhost:18080';
const sockets = [];
const checks = [];
async function request(path, { method = 'GET', token, host, body, expected = 200 } = {}) {
  const response = await fetch(`${base}/api/v1${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Session-Token': token } : {}), ...(host ? { 'X-Host-Token': host } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} expected ${expected}`);
  const data = await response.json();
  return data.data;
}
async function until(predicate, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
async function socket(slug, token) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws/websocket');
  const frames = [];
  let closed = false;
  ws.addEventListener('message', event => { frames.push(String(event.data)); });
  ws.addEventListener('close', () => { closed = true; });
  sockets.push(ws);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.send(`CONNECT\naccept-version:1.2\nheart-beat:0,0\nX-Room-Slug:${slug}\nX-Session-Token:${token}\n\n\0`);
  await until(() => closed || frames.some(frame => frame.startsWith('CONNECTED') || frame.startsWith('ERROR')), 'CONNECT');
  return { ws, frames, get closed() { return closed; },
    subscribe(destination) { ws.send(`SUBSCRIBE\nid:sub-${Math.random()}\ndestination:${destination}\nack:auto\n\n\0`); } };
}
try {
  assert.equal((await fetch(`${base}/internal/metrics`)).status, 404);
  const origin = await fetch(`${base}/api/v1/rooms/not-a-room`, { method: 'OPTIONS',
    headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(origin.status, 403);
  await new Promise((resolve, reject) => {
    const request = http.request(`${base}/ws/websocket`, { headers: { Origin: 'https://untrusted.example',
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64') } }, response => {
      response.resume();
      try { assert.equal(response.statusCode, 403); resolve(); } catch(error) { reject(error); }
    });
    request.on('upgrade', (_response, socket) => { socket.destroy(); reject(new Error('Untrusted origin was allowed')); });
    request.on('error', reject); request.setTimeout(10000, () => request.destroy(new Error('Origin check timed out'))); request.end();
  });
  checks.push('private metrics hidden, untrusted REST and WebSocket origins rejected');
  const host = await request('/rooms', { method: 'POST', body: { title: 'Disposable acceptance', hostNickname: 'Host', ttlMinutes: 5 } });
  const prefix = `/rooms/${host.slug}`;
  const guest = await request(prefix + '/join', { method: 'POST', body: { nickname: 'Guest' } });
  await request(prefix + '/messages', { expected: 403 });
  const liveHost = await socket(host.slug, host.sessionToken);
  const liveGuest = await socket(host.slug, guest.sessionToken);
  assert.ok(liveGuest.frames.some(frame => frame.startsWith('CONNECTED')));
  liveHost.subscribe(`/topic/room.${host.slug}.events`);
  liveGuest.subscribe(`/topic/room.${host.slug}.messages`);
  await until(async () => (await request(prefix + '/presence', { token: host.sessionToken })).includes(guest.guestId), 'presence');
  checks.push('authenticated WebSocket CONNECT and shared presence');

  await request(prefix + '/polls', { method: 'POST', token: guest.sessionToken, body: { question: 'Forbidden', options: ['A', 'B'] }, expected: 403 });
  const poll = await request(prefix + '/polls', { method: 'POST', token: host.sessionToken, body: { question: 'Choose', options: ['A', 'B'] } });
  await request(prefix + `/polls/${poll.id}/votes`, { method: 'POST', token: guest.sessionToken, body: { optionId: poll.options[0].id } });
  const message = await request(prefix + '/messages', { method: 'POST', token: host.sessionToken, body: { clientMessageId: crypto.randomUUID(), body: 'Original' } });
  const reply = await request(prefix + '/messages', { method: 'POST', token: guest.sessionToken, body: { clientMessageId: crypto.randomUUID(), body: 'Reply', replyToId: message.id } });
  assert.equal(reply.replyToId, message.id);
  await until(() => liveGuest.frames.some(frame => frame.includes('Original')), 'message relay');
  checks.push('Host-only poll creation, voting, persisted replies, broker delivery');

  const wheel = await request(prefix + '/wheels', { method: 'POST', token: host.sessionToken, body: { title: 'Wheel', entries: ['A', 'B'], excludeWinner: true } });
  const spin = await request(prefix + `/wheels/${wheel.id}/spin`, { method: 'POST', token: host.sessionToken, body: { idempotencyKey: crypto.randomUUID() } });
  const wheels = await request(prefix + '/wheels', { token: host.sessionToken });
  assert.equal(wheels[0].entries.length, 1);
  assert.ok(!wheels[0].entries.includes(spin.resultEntry));
  const decision = await request(prefix + '/decisions', { method: 'POST', token: guest.sessionToken, body: { text: 'Agreed', proposeImmediately: true } });
  await request(prefix + `/decisions/${decision.id}/status`, { method: 'PATCH', host: host.hostToken, body: { status: 'CONFIRMED' } });
  const report = await request(prefix + '/export', { host: host.hostToken });
  assert.equal(report.polls.length, 1); assert.equal(report.wheels.length, 1); assert.equal(report.confirmedDecisions.length, 1);
  assert.ok(report.markdownSummary.includes('Agreed'));
  checks.push('exclude-winner persistence, decision PATCH and server report');

  await request(prefix + '/join-lock', { method: 'PATCH', host: host.hostToken, body: { joinLocked: true } });
  await request(prefix + '/join', { method: 'POST', body: { nickname: 'Blocked' }, expected: 409 });
  await until(() => liveHost.frames.some(frame => frame.includes('JOIN_LOCK_CHANGED')), 'join-lock notification');
  // Allow host-write bucket refill before the remaining administrative actions.
  await new Promise(resolve => setTimeout(resolve, 1100));
  await request(prefix + `/participants/${guest.guestId}/kick`, { method: 'POST', host: host.hostToken });
  await until(() => liveGuest.closed, 'kick closes socket');
  await request(prefix + '/messages', { token: guest.sessionToken, expected: 403 });
  await request(prefix + '/reconnect', { method: 'POST', token: guest.sessionToken, expected: 403 });
  const denied = await socket(host.slug, guest.sessionToken);
  assert.ok(!denied.frames.some(frame => frame.startsWith('CONNECTED')));
  checks.push('join lock event, kick closes socket, revoked token cannot read/reconnect/CONNECT');

  const crossRoom = await socket(host.slug, host.sessionToken);
  crossRoom.subscribe('/topic/room.other.messages');
  await until(() => crossRoom.closed || crossRoom.frames.some(frame => frame.startsWith('ERROR')), 'cross-room rejection');
  const spoof = await socket(host.slug, host.sessionToken);
  spoof.ws.send(`SEND\ndestination:/topic/room.${host.slug}.messages\n\nspoof\0`);
  await until(() => spoof.closed || spoof.frames.some(frame => frame.startsWith('ERROR')), 'spoof rejection');
  checks.push('cross-room subscriptions and client topic spoofing rejected');

  await request(prefix + '/close', { method: 'POST', host: host.hostToken });
  await request(prefix + '/messages', { token: host.sessionToken });
  await request(prefix + '/messages', { method: 'POST', token: host.sessionToken, body: { clientMessageId: crypto.randomUUID(), body: 'Too late' }, expected: 400 });
  checks.push('closed room remains readable and refuses writes');
  console.log(JSON.stringify({ base, passed: checks, room: host.slug }, null, 2));
} finally { sockets.forEach(ws => { try { ws.close(); } catch {} }); }
