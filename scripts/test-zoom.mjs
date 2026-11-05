import { chromium } from '../frontend/node_modules/playwright/index.mjs';

async function testZoom() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:18082');

  await page.fill('#create-room-title', 'Zoom Test Room');
  await page.click('button[form="form-create-room"]');
  await page.waitForURL(/\/rooms\/.+/, { timeout: 10000 });
  await page.waitForSelector('input[placeholder="Nhập tin nhắn thảo luận..."]');

  // Test zoom on chat input
  await page.evaluate(() => {
    const root = document.getElementById('root');
    root.style.transition = 'transform 0.6s ease';
    root.style.transformOrigin = '50% 80%';
    root.style.transform = 'scale(1.12)';
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/test-zoom-chat.png' });

  // Reset zoom
  await page.evaluate(() => {
    const root = document.getElementById('root');
    root.style.transform = 'none';
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/test-zoom-reset.png' });

  console.log('Saved test-zoom-chat.png and test-zoom-reset.png');
  await browser.close();
}

testZoom().catch(console.error);
