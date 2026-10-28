// Small local rehearsal only; creates one disposable room.
import assert from 'node:assert/strict';
const base = process.env.EVENTCHAT_ACCEPTANCE_URL || 'http://localhost:18080';
const response = await fetch(`${base}/api/v1/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Disposable load smoke', hostNickname: 'Host', ttlMinutes: 5 }) });
assert.equal(response.status, 200);
const { data: host } = await response.json();
const concurrency = 10, total = 200;
const latencies = [];
let next = 0, errors = 0;
const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next++ < total) {
    const start = performance.now();
    try {
      const result = await fetch(`${base}/api/v1/rooms/${host.slug}/messages`, {
        headers: { 'X-Session-Token': host.sessionToken }, signal: AbortSignal.timeout(10000) });
      if (result.status !== 200) errors++;
      await result.arrayBuffer();
    } catch { errors++; }
    latencies.push(performance.now() - start);
  }
}));
latencies.sort((a,b) => a-b);
const durationMs = performance.now() - started;
console.log(JSON.stringify({ environment: 'local disposable stack', requests: total, concurrency, errors,
  durationMs: Math.round(durationMs), requestsPerSecond: Math.round(total / durationMs * 1000),
  p50Ms: Math.round(latencies[Math.floor(total * .5)]), p95Ms: Math.round(latencies[Math.floor(total * .95)]),
  p99Ms: Math.round(latencies[Math.floor(total * .99)]) }, null, 2));
assert.equal(errors, 0);
