// Disposable stack only. Respects public join rate limits while preparing 49 sessions.
import assert from 'node:assert/strict';
const base = process.env.EVENTCHAT_ACCEPTANCE_URL || 'http://localhost:18080';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(path, { method='GET', token, body }={}) {
  return fetch(`${base}/api/v1${path}`, { method,
    headers: { 'Content-Type':'application/json', ...(token ? {'X-Session-Token':token} : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(15000) });
}
const create = await api('/rooms', {method:'POST', body:{title:'Disposable capacity acceptance',hostNickname:'Host',ttlMinutes:5}});
assert.equal(create.status,200);
const host = (await create.json()).data;
const prefix = `/rooms/${host.slug}`;
const actors = [host];
while (actors.length < 49) {
  const joined = await api(prefix+'/join',{method:'POST',body:{nickname:`Guest ${actors.length}`}});
  if (joined.status === 429) { await pause(Math.max(1000,Number(joined.headers.get('retry-after')||1)*1000)); continue; }
  assert.equal(joined.status,200);
  actors.push((await joined.json()).data);
}
await pause(8500);
const race = await Promise.all(Array.from({length:8},(_,i)=>api(prefix+'/join',{method:'POST',body:{nickname:`Last slot ${i}`}})));
assert.equal(race.filter(response=>response.status===200).length,1);
assert.equal(race.filter(response=>response.status===409).length,7);
for (const response of race) if(response.status===200) actors.push((await response.json()).data);
const details = (await (await api(prefix,{token:host.sessionToken})).json()).data;
assert.equal(details.participants.length,50);
const sockets=[];
try {
  const connected = await Promise.all(actors.map(actor=>new Promise((resolve,reject)=>{
    const socket = new WebSocket(base.replace(/^http/,'ws')+'/ws/websocket');
    sockets.push(socket);
    const timer=setTimeout(()=>reject(new Error('CONNECT timeout')),15000);
    socket.onopen=()=>socket.send(`CONNECT\naccept-version:1.2\nheart-beat:0,0\nX-Room-Slug:${host.slug}\nX-Session-Token:${actor.sessionToken}\n\n\0`);
    socket.onmessage=event=>{
      if(String(event.data).startsWith('CONNECTED')) { clearTimeout(timer); resolve(true); }
      if(String(event.data).startsWith('ERROR')) { clearTimeout(timer); reject(new Error('CONNECT rejected')); }
    };
    socket.onerror=()=>{clearTimeout(timer);reject(new Error('WebSocket failed'));};
  })));
  assert.equal(connected.length,50);
  const online=(await (await api(prefix+'/presence',{token:host.sessionToken})).json()).data;
  assert.equal(online.length,50);
  console.log(JSON.stringify({room:host.slug,sessionCount:50,concurrentLastSlotRequests:8,accepted:1,conflicts:7,
    authenticatedSockets:50,onlineGuests:50,stack:'real MySQL/Mongo/Redis/Rabbit, local rehearsal'},null,2));
} finally { sockets.forEach(socket=>socket.close()); }
