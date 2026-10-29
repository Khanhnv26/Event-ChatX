// Creates no application data. Run only on the disposable Caddy rehearsal stack.
import assert from 'node:assert/strict';

const base = process.env.EVENTCHAT_ATTACHMENT_URL || 'http://localhost:18082';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):18082$/);
const checks = [];

const page = await fetch(`${base}/rooms/edge-routing-check`);
assert.equal(page.status, 200);
assert.match(page.headers.get('content-type'), /text\/html/);
assert.equal(page.headers.get('cache-control'), 'no-cache');
const html = await page.text();
assert.match(html, /id="root"/);
const assetPath = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
assert.ok(assetPath, 'Vite JavaScript asset is present');
const asset = await fetch(`${base}${assetPath}`);
assert.equal(asset.status, 200);
assert.match(asset.headers.get('cache-control'), /max-age=31536000, immutable/);
assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
checks.push('SPA fallback and immutable assets without asset-to-index fallback');

const missingApi = await fetch(`${base}/api/v1/edge-route-does-not-exist`);
assert.equal(missingApi.status, 404);
assert.doesNotMatch(missingApi.headers.get('content-type') || '', /text\/html/);
const sockjs = await fetch(`${base}/ws/info`);
assert.equal(sockjs.status, 200);
assert.equal((await sockjs.json()).websocket, true);
checks.push('API paths and SockJS subpaths reach backend instead of SPA');

for (const path of ['/internal/health', '/internal/metrics', '/actuator/prometheus']) {
  assert.equal((await fetch(`${base}${path}`)).status, 404, path);
}
checks.push('Health and Actuator endpoints stay private');

const oversizedJson = await fetch(`${base}/api/v1/rooms`, {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({title: 'x'.repeat(65536), hostNickname: 'Edge size test'}),
});
assert.equal(oversizedJson.status, 413);
checks.push('Caddy rejects JSON request bodies larger than 64 KiB');

console.log(JSON.stringify({result: 'PASS', checks}, null, 2));
