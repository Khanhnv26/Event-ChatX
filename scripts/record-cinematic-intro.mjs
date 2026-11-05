import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { mkdir, copyFile, writeFile, readdir, access, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts/videos');
const FPS = 60;

async function findFFmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  // Playwright bundles an encoder. Prefer it to an additional download.
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.USERPROFILE || '', 'AppData/Local/ms-playwright');
  for (const dir of (await readdir(cache)).filter(name => name.startsWith('ffmpeg-')).sort().reverse()) {
    const candidate = path.join(cache, dir, process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg-linux');
    try { await access(candidate); return candidate; } catch { /* Try the next installation. */ }
  }
  throw new Error('Set FFMPEG_PATH to an FFmpeg binary with libvpx-vp9 support.');
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const html = path.join(OUT, 'cinematic-intro.html');
  await copyFile(path.join(ROOT, 'scripts/cinematic-intro.html'), html);
  await copyFile(path.join(ROOT, 'scripts/watch-intro.html'), path.join(OUT, 'watch-demo.html'));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  let encoder;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(html).href + '?render', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const duration = await page.evaluate(() => window.intro.duration);
    const checks = [];
    for (const [time, scene] of [[3, 'hero'], [10, 'chat'], [19, 'vote'], [27, 'decide'], [33, 'outro']]) {
      await page.evaluate(t => window.intro.seek(t), time);
      const state = await page.evaluate(id => {
        const scene = document.getElementById(id);
        const rect = scene.getBoundingClientRect();
        const overlaps = [...document.elementsFromPoint(900, 350)]
          .filter(el => !el.matches('.replay') && el.closest('.scene'));
        return { opacity: Number(getComputedStyle(scene).opacity), width: rect.width,
          topScene: overlaps[0]?.closest('.scene')?.id,
          text: scene.innerText, externalResources: performance.getEntriesByType('resource').filter(r => /^https?:/.test(r.name)).length };
      }, scene);
      assert.equal(state.opacity, 1, `${scene} is not fully visible`);
      assert.equal(state.width, 1280);
      assert.equal(state.externalResources, 0, 'Intro must work offline');
      await page.screenshot({ path: path.join(OUT, `preview-${scene}.png`) });
      checks.push({ scene, time, ...state });
    }
    // Seek backwards as well: no stale callbacks, overlays, counters or timers.
    await page.evaluate(() => { window.intro.seek(19); window.intro.seek(14); });
    assert.equal(await page.locator('#pct1').textContent(), '0%');
    assert.equal(await page.locator('#theme-sweep-overlay').count(), 0);
    assert.deepEqual(errors, []);
    await writeFile(path.join(OUT, 'intro-validation.json'), JSON.stringify({ duration, fps: FPS, errors, checks }, null, 2));
    console.log('PASS: all five scenes visible, offline, deterministic rewind, no script errors.');
    if (process.argv.includes('--preview')) return;

    const ffmpeg = await findFFmpeg();
    console.log(`Encoder: ${ffmpeg}`);
    const temporary = path.join(OUT, 'eventchat-cinematic-intro.rendering.webm');
    encoder = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', 'pipe:0',
      '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '27', '-deadline', 'realtime',
      '-cpu-used', '6', '-row-mt', '1', '-pix_fmt', 'yuv420p', temporary], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let diagnostic = '';
    encoder.stderr.on('data', data => { diagnostic = (diagnostic + data).slice(-8000); });
    encoder.stdin.on('error', () => {});
    const finished = new Promise((resolve, reject) => {
      encoder.on('error', reject);
      encoder.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${diagnostic}`)));
    });
    // Register rejection immediately, including failures while screenshots are being generated.
    finished.catch(() => {});
    const frames = Math.round(duration * FPS);
    console.log(`Rendering ${frames} frames at ${FPS}fps...`);
    for (let frame = 0; frame < frames; frame++) {
      if (encoder.exitCode !== null) throw new Error(diagnostic || 'Encoder stopped');
      await page.evaluate(t => window.intro.seek(t), frame / FPS);
      const image = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!encoder.stdin.write(image)) {
        await Promise.race([once(encoder.stdin, 'drain'), finished.then(() => { throw new Error('Encoder stopped before receiving every frame'); })]);
      }
      if (frame % (FPS * 3) === 0) console.log(`Render ${Math.round(frame / frames * 100)}% · ${frame}/${frames} frames`);
    }
    encoder.stdin.end();
    await finished;
    assert.deepEqual(errors, []);
    await rename(temporary, path.join(OUT, 'eventchat-cinematic-intro.webm'));
    console.log(`Exported ${duration}s · 1280×720 · ${FPS}fps · ${frames} frames`);
  } finally {
    if (encoder && encoder.exitCode === null) encoder.kill();
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
