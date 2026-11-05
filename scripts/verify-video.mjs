import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import path from 'node:path';

async function verifyVideo() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  const videoUrl = 'file:///' + path.resolve('artifacts/videos/watch-demo.html').replace(/\\/g, '/');
  await page.goto(videoUrl);
  await page.waitForTimeout(1000);

  const duration = await page.evaluate(() => {
    const v = document.getElementById('player');
    return v.duration;
  });
  console.log('Video duration:', duration, 'seconds');

  // Capture snapshots at various timestamps to verify content
  const timestamps = [2, 8, 16, 23, 30, 40, 48, 55];
  for (const t of timestamps) {
    await page.evaluate((time) => {
      const v = document.getElementById('player');
      v.currentTime = time;
    }, t);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `artifacts/videos/frame-${t}s.png` });
    console.log(`Saved frame-${t}s.png`);
  }

  await browser.close();
}

verifyVideo().catch(console.error);
