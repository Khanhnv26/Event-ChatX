import { chromium } from '../frontend/node_modules/playwright/index.mjs';

async function testSnapshot() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:18082');

  await page.fill('#create-room-title', 'Workshop: Kiến trúc Modular Monolith & Living Tools');
  await page.click('button[form="form-create-room"]');
  await page.waitForURL(/\/rooms\/.+/, { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Take screenshot in Light Mode
  await page.screenshot({ path: 'artifacts/real-ui-room-light.png' });
  console.log('Saved Light Mode screenshot: artifacts/real-ui-room-light.png');

  // Toggle Dark Mode
  await page.click('button[aria-label="Toggle theme"]');
  await page.waitForTimeout(1000);

  // Take screenshot in Dark Mode
  await page.screenshot({ path: 'artifacts/real-ui-room-dark.png' });
  console.log('Saved Dark Mode screenshot: artifacts/real-ui-room-dark.png');

  await browser.close();
}

testSnapshot().catch(console.error);
