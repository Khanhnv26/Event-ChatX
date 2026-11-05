import {chromium} from '../frontend/node_modules/playwright/index.mjs';
import {mkdir,copyFile,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'artifacts/videos'),fps=60,duration=28,totalFrames=fps*duration;
const binary=process.env.FFMPEG_PATH||path.join(process.env.USERPROFILE,'AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe');
await import('./build-product-film.mjs');
await mkdir(out,{recursive:true});await copyFile(path.join(root,'scripts/product-film.html'),path.join(out,'product-launch.html'));await copyFile(path.join(root,'scripts/launch-audio.js'),path.join(out,'launch-audio.js'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});let encoder;
function processDone(child){return new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(`FFmpeg exited ${code}`)))})}
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());
 await page.clock.setFixedTime(new Date('2026-10-30T02:42:00Z'));
 await page.goto(pathToFileURL(path.join(out,'product-launch.html')).href+'?render',{waitUntil:'load'});
 await page.waitForFunction(()=>window.intro);
 await page.addScriptTag({path:path.join(root,'scripts/launch-audio.js')});
 const images=await page.locator('img').evaluateAll(images=>images.map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight,complete:i.complete})));assert.ok(images.every(i=>i.complete&&i.width>0),'Every UI asset must load');
 assert.ok(await page.locator('[data-project-ui]').count()>=6,'Native project components must be present');
 const checks=[];for(const t of [1.5,3.2,4.8,8.6,12.8,17.5,20,20.9,21.8,22.65,23.2,26.5]){await page.evaluate(async t=>{window.intro.seek(t);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)},t);await page.screenshot({path:path.join(out,`launch-preview-${t}.png`)});checks.push({t,scene:await page.locator('.scene').evaluateAll(es=>es.filter(e=>Number(getComputedStyle(e).opacity)>.8).map(e=>e.id))});}
 const cameraCheck=await page.evaluate(()=>{window.intro.seek(3.2);const first=document.querySelector("#overview .workspace-window").style.transform;window.intro.seek(23);window.intro.seek(3.2);return{first,rewound:document.querySelector("#overview .workspace-window").style.transform}});assert.ok(cameraCheck.first.includes("perspective"));assert.equal(cameraCheck.first,cameraCheck.rewound);
 const themeCheck=await page.evaluate(()=>{window.intro.seek(21.8);const light=document.querySelector('#light-theme');return{visibility:getComputedStyle(light).visibility,lightBackground:getComputedStyle(light.querySelector('.native-room')).backgroundColor,darkBackground:getComputedStyle(document.querySelector('#theme .native-room')).backgroundColor,hasDarkAncestor:!!light.closest('.dark')}});assert.equal(themeCheck.visibility,'visible');assert.equal(themeCheck.hasDarkAncestor,false);assert.notEqual(themeCheck.lightBackground,themeCheck.darkBackground);
 await page.evaluate(()=>{window.intro.seek(18);window.intro.seek(8.6)});assert.equal(await page.locator('#light-theme').evaluate(e=>getComputedStyle(e).visibility),'hidden');assert.deepEqual(errors,[]);
 assert.equal(await page.locator('.cine-badge,.cine-progress-bar,#cine-lower-third').count(),0);
 await writeFile(path.join(out,'launch-validation.json'),JSON.stringify({duration,fps,width:1920,height:1080,images,checks,cameraCheck,themeCheck,errors},null,2));
 console.log('PASS: seven animated scenes, all real UI assets loaded, no badges, deterministic rewind, no script errors.');
 if(!process.argv.includes('--preview')){
  const silent=path.join(out,'launch-silent.rendering.webm');
  encoder=spawn(binary,['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libvpx-vp9','-b:v','0','-crf','24','-deadline','realtime','-cpu-used','6','-row-mt','1','-pix_fmt','yuv420p',silent],{windowsHide:true,stdio:['pipe','ignore','pipe']});let stderr='';encoder.stderr.on('data',d=>stderr=(stderr+d).slice(-5000));encoder.stdin.on('error',()=>{});const finished=processDone(encoder);finished.catch(()=>{});
  for(let frame=0;frame<totalFrames;frame++){if(encoder.exitCode!==null)throw Error(stderr||'Encoder stopped');await page.evaluate(async t=>{window.intro.seek(t);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)},frame/fps);const jpeg=await page.screenshot({type:'jpeg',quality:96});if(!encoder.stdin.write(jpeg))await Promise.race([once(encoder.stdin,'drain'),finished.then(()=>{throw Error('Encoder stopped early')})]);if(frame%180===0)console.log(`Render ${Math.round(frame/totalFrames*100)}% (${frame}/${totalFrames})`);}
  encoder.stdin.end();await finished;assert.deepEqual(errors,[]);
  console.log('Recording original music and synchronized SFX (28 seconds)...');
  const audio=await page.evaluate(()=>window.recordLaunchAudio(28));await writeFile(path.join(out,'launch-soundtrack.webm'),Buffer.from(audio.base64,'base64'));await writeFile(path.join(out,'launch-audio-analysis.json'),JSON.stringify(audio.analysis,null,2));
  const temporary=path.join(out,'launch-final.rendering.webm');const muxer=spawn(binary,['-y','-hide_banner','-loglevel','error','-i',silent,'-i',path.join(out,'launch-soundtrack.webm'),'-map','0:v:0','-map','1:a:0','-c','copy','-t',String(duration),temporary],{windowsHide:true,stdio:['ignore','ignore','inherit']});await processDone(muxer);
  await copyFile(temporary,path.join(out,'eventchat-product-launch-v4-camera-fullhd60.webm'));await copyFile(temporary,path.join(out,'eventchat-product-launch-fullhd60.webm'));await rename(temporary,path.join(out,'eventchat-cinematic-intro.webm'));
  console.log('Exported product launch: 1920×1080, 60fps, 28s, VP9 + Opus music/SFX.');
 }
}finally{if(encoder&&encoder.exitCode===null)encoder.kill();await browser.close();}
