// Pauses ONLY the disposable acceptance Redis container. Never point this at production.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const base = process.env.EVENTCHAT_ACCEPTANCE_URL || 'http://localhost:18080';
assert.ok(new URL(base).hostname === 'localhost' || new URL(base).hostname === '127.0.0.1');
const created = await fetch(`${base}/api/v1/rooms`, { method: 'POST', headers: {'Content-Type':'application/json'},
  body:JSON.stringify({title:'Disposable failure acceptance',hostNickname:'Host',ttlMinutes:5}) });
assert.equal(created.status,200);
const {data:host} = await created.json();
const path = `${base}/api/v1/rooms/${host.slug}/messages`;
const headers = {'Content-Type':'application/json','X-Session-Token':host.sessionToken};
const write = () => fetch(path,{method:'POST',headers,
  body:JSON.stringify({clientMessageId:crypto.randomUUID(),body:'Dependency recovery test'}),signal:AbortSignal.timeout(10000)});
try {
  execFileSync('docker',['pause','eventchat-acceptance-redis-1'],{stdio:'ignore'});
  const denied = await write();
  assert.equal(denied.status,503);
  assert.equal(denied.headers.get('retry-after'),'1');
  const read = await fetch(path,{headers,signal:AbortSignal.timeout(10000)});
  assert.equal(read.status,200);
} finally { execFileSync('docker',['unpause','eventchat-acceptance-redis-1'],{stdio:'ignore'}); }
let recovered = false;
for(let attempt=0;attempt<10;attempt++) {
  const response=await write();
  if(response.status===200) { recovered=true; break; }
  await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(recovered);
console.log('VERIFIED: Redis outage fails writes closed with 503/Retry-After, reads continue, writes recover after Redis resumes.');
