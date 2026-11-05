import { chromium } from '../frontend/node_modules/playwright/index.mjs';

async function testWidth() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  for (const w of [1280, 1366, 1440]) {
    const page = await browser.newPage({ viewport: { width: w, height: 720 } });
    await page.goto('http://127.0.0.1:18082');
    const matches1280 = await page.evaluate(() => window.matchMedia('(min-width: 1280px)').matches);
    const bodyWidth = await page.evaluate(() => document.body.clientWidth);
    console.log(`Viewport ${w}x720 -> matches (min-width: 1280px): ${matches1280}, body width: ${bodyWidth}`);
    await page.close();
  }
  await browser.close();
}

testWidth().catch(console.error);
