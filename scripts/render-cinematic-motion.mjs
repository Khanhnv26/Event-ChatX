import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { copyFile, mkdir, access, writeFile, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'artifacts/videos'),fps=60;
await mkdir(out,{recursive:true});
await access(path.join(out,'eventchat-real-ui-source.webm'));
await copyFile(path.join(root,'scripts/cinematic-motion.html'),path.join(out,'cinematic-motion.html'));
const browser=await chromium.launch({channel:'chrome',headless:true});
let encoder;
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,r=>r.abort());
 await page.goto(pathToFileURL(path.join(out,'cinematic-motion.html')).href+'?render');
 await page.waitForFunction(()=>window.intro);
 const duration=await page.evaluate(()=>window.intro.duration);
 const checks=[];
 for(const t of [1.5,7,12,17,20.8,23,28,34.8,37.5,42]){
  const state=await page.evaluate(async t=>{const source=await window.intro.seek(t);const video=document.querySelector('video');return{...source,width:video.videoWidth,height:video.videoHeight,camera:document.querySelector('#rig').style.transform,overlays:document.querySelectorAll('.cine-progress-bar,#cine-lower-third,.cine-badge').length}},t);
  assert.equal(state.width,1920);assert.equal(state.height,1080);assert.equal(state.overlays,0);
  assert.ok(!/rotate|perspective/.test(state.camera),'Product shots must stay frontal');
  await page.screenshot({path:path.join(out,`motion-${t}s.png`)});checks.push(state);
 }
 await page.evaluate(()=>window.intro.seek(7));
 assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'motion-validation.json'),JSON.stringify({duration,fps,sourceFps:25,checks,errors},null,2));
 console.log('PASS: native Full HD UI source, restrained planar motion, backwards seek, zero badges, offline, no script errors.');
 if(!process.argv.includes('--preview')){
  const binary=process.env.FFMPEG_PATH||path.join(process.env.USERPROFILE,'AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe');
  const temp=path.join(out,'eventchat-motion.rendering.webm');
  encoder=spawn(binary,['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libvpx-vp9','-b:v','0','-crf','25','-deadline','realtime','-cpu-used','6','-row-mt','1','-pix_fmt','yuv420p',temp],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let stderr='';encoder.stderr.on('data',d=>stderr=(stderr+d).slice(-8000));encoder.stdin.on('error',()=>{});
  const finished=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code===0?resolve():reject(Error(`Encoder ${code}: ${stderr}`)))});finished.catch(()=>{});
  const frames=duration*fps;
  for(let frame=0;frame<frames;frame++){
   if(encoder.exitCode!==null)throw Error(stderr||'Encoder stopped');
   await page.evaluate(t=>window.intro.seek(t),frame/fps);
   const jpeg=await page.screenshot({type:'jpeg',quality:96});
   if(!encoder.stdin.write(jpeg))await Promise.race([once(encoder.stdin,'drain'),finished.then(()=>{throw Error('Encoder stopped early')})]);
   if(frame%(fps*4)===0)console.log(`Render ${Math.round(frame/frames*100)}% (${frame}/${frames})`);
  }
  encoder.stdin.end();await finished;assert.deepEqual(errors,[]);
  await rename(temp,path.join(out,'eventchat-cinematic-intro.webm'));
  console.log(`Exported ${duration}s / ${fps}fps / ${frames} frames`);
 }
}finally{if(encoder&&encoder.exitCode===null)encoder.kill();await browser.close();}
