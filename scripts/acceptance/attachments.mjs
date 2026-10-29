import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.EVENTCHAT_ATTACHMENT_URL || 'http://localhost:18082';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):18082$/, 'Use the disposable attachment stack on port 18082');
const checks = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, method = 'GET', body, token, contentType = 'application/json') {
  const response = await fetch(`${base}/api/v1${path}`, { method,
    headers: { 'Content-Type': contentType, ...(token ? { 'X-Session-Token': token } : {}) },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  return { response, data };
}

function png() {
  const chunk = (name, bytes) => {
    const content = Buffer.concat([Buffer.from(name), bytes]);
    let crc = 0xffffffff;
    for (const value of content) {
      crc ^= value;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, content, checksum]);
  };
  const width = 640, height = 360;
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    pixels[offset] = 70 + Math.floor(60 * x / width);
    pixels[offset + 1] = 60 + Math.floor(80 * y / height);
    pixels[offset + 2] = 210;
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

const roomResult = await request('/rooms', 'POST', { title: 'Kiểm thử ảnh và tài liệu', hostNickname: 'Upload Host' });
assert.equal(roomResult.response.status, 200);
const host = roomResult.data.data;
const prefix = `/rooms/${host.slug}`;
const memberResult = await request(`${prefix}/join`, 'POST', { nickname: 'Upload Member' });
assert.equal(memberResult.response.status, 200);
const member = memberResult.data.data;

async function upload(filename, type, bytes, expected = 'READY') {
  const intent = await request(`${prefix}/attachments`, 'POST', {
    clientUploadId: crypto.randomUUID(), filename, declaredContentType: type, sizeBytes: bytes.length,
  }, host.sessionToken);
  assert.equal(intent.response.status, 200, JSON.stringify(intent.data));
  const id = intent.data.data.publicId;
  const received = await request(`${prefix}/attachments/${id}/content`, 'PUT', bytes, host.sessionToken, 'application/octet-stream');
  assert.equal(received.response.status, 200, JSON.stringify(received.data));
  for (let attempt = 0; attempt < 120; attempt++) {
    const status = await request(`${prefix}/attachments/${id}`, 'GET', undefined, host.sessionToken);
    if (status.data?.data?.state === expected) return status.data.data;
    if (status.data?.data?.state === 'REJECTED' && expected !== 'REJECTED') throw new Error(`File rejected: ${status.data.data.errorCode}`);
    await pause(500);
  }
  throw new Error(`Upload did not reach ${expected}`);
}

const imageBytes = png();
const image = await upload('eventchat-demo.png', 'image/png', imageBytes);
assert.equal(image.width, 640); assert.equal(image.height, 360); assert.equal(image.hasThumbnail, true);
checks.push('Real ClamAV scan + image normalization + thumbnail');
const document = await upload('bien-ban.txt', 'text/plain', Buffer.from('EventChat: tài liệu kiểm thử upload ảnh và file.\n'));
const privateDraft = await request(`${prefix}/attachments/${document.publicId}/content`, 'GET', undefined, member.sessionToken);
assert.equal(privateDraft.response.status, 403);
checks.push('Unlinked draft is private to its uploader');

const clientMessageId = crypto.randomUUID();
const payload = { clientMessageId, body: '', attachmentIds: [image.publicId, document.publicId] };
const sent = await request(`${prefix}/messages`, 'POST', payload, host.sessionToken);
assert.equal(sent.response.status, 200, JSON.stringify(sent.data));
assert.equal(sent.data.data.attachments.length, 2);
const retry = await request(`${prefix}/messages`, 'POST', payload, host.sessionToken);
assert.equal(retry.response.status, 200); assert.equal(retry.data.data.id, sent.data.data.id);
const conflict = await request(`${prefix}/messages`, 'POST', { ...payload, body: 'Changed payload' }, host.sessionToken);
assert.equal(conflict.response.status, 409);
checks.push('Attachment-only message + idempotent retry + payload conflict');

const thumbnail = await request(`${prefix}/attachments/${image.publicId}/thumbnail`, 'GET', undefined, member.sessionToken);
assert.equal(thumbnail.response.status, 200);
assert.equal(thumbnail.response.headers.get('content-type'), 'image/jpeg');
assert.match(thumbnail.response.headers.get('cache-control'), /no-store/);
const download = await request(`${prefix}/attachments/${document.publicId}/content`, 'GET', undefined, member.sessionToken);
assert.equal(download.response.status, 200);
assert.match(download.response.headers.get('content-disposition'), /^attachment/);
const unauthorized = await request(`${prefix}/attachments/${image.publicId}/content`);
assert.equal(unauthorized.response.status, 403);
checks.push('Protected thumbnail/download + no-store + forced document download');

const rejected = await upload('fake.png', 'image/png', Buffer.from('plain text pretending to be PNG'), 'REJECTED');
assert.equal(rejected.errorCode, 'INVALID_CONTENT');
const eicar = Buffer.from(['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-', 'STANDARD-ANTIVIRUS-TEST-FILE!', '$H+H*'].join(''));
const unsafe = await upload('antivirus-test.txt', 'text/plain', eicar, 'REJECTED');
assert.equal(unsafe.errorCode, 'UNSAFE_FILE');
checks.push('Reject spoofed image + harmless EICAR antivirus test signature');

const removable = await upload('remove-me.txt', 'text/plain', Buffer.from('temporary draft'));
const cancel = await request(`${prefix}/attachments/${removable.publicId}`, 'DELETE', undefined, host.sessionToken);
assert.equal(cancel.response.status, 200);
const cancelled = await request(`${prefix}/attachments/${removable.publicId}/content`, 'GET', undefined, host.sessionToken);
assert.ok([403, 409].includes(cancelled.response.status));
checks.push('Cancellation blocks further content access');

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/attachment-ui-demo.png', imageBytes);
await writeFile('artifacts/attachment-ui-demo.txt', 'Biên bản EventChat: kiểm thử UI upload tài liệu.\n');
await writeFile('artifacts/attachment-ui-live-report.json', JSON.stringify({ base, slug: host.slug, checks }, null, 2));
console.log(JSON.stringify({ result: 'PASS', room: `${base}/rooms/${host.slug}`, checks }, null, 2));
