import { chromium } from '../frontend/node_modules/playwright/index.mjs';

async function checkElements() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:18082');

  await page.fill('#create-room-title', 'Workshop Test');
  await page.click('button[form="form-create-room"]');
  await page.waitForURL(/\/rooms\/.+/, { timeout: 10000 });
  await page.waitForSelector('input[placeholder="Nhập tin nhắn thảo luận..."]');

  const visibleTexts = await page.evaluate(() => {
    return {
      title: document.title,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
      inputs: Array.from(document.querySelectorAll('input')).map(i => i.placeholder || i.getAttribute('aria-label')).filter(Boolean)
    };
  });
  console.log(JSON.stringify(visibleTexts, null, 2));

  await browser.close();
}

checkElements().catch(console.error);
