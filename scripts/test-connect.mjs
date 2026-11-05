import { chromium } from '../frontend/node_modules/playwright/index.mjs';

async function testRoom() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:18082');
  
  await page.click('#create-room-title');
  await page.fill('#create-room-title', 'Demo Room');
  await page.click('button[form="form-create-room"]');
  await page.waitForURL(/\/rooms\/.+/, { timeout: 10000 });
  
  console.log('Room URL:', page.url());
  await page.waitForTimeout(1000);
  
  // Check layout elements
  const hasDecisionPanel = await page.locator('text=Quyết định').count();
  const hasChatInput = await page.locator('input[placeholder="Nhập tin nhắn thảo luận..."]').count();
  const hasToolbar = await page.locator('button:has-text("Bình chọn")').count();
  const hasWheel = await page.locator('button:has-text("Vòng quay")').count();
  const hasExport = await page.locator('button:has-text("Xuất biên bản")').count();
  
  console.log({
    hasDecisionPanel,
    hasChatInput,
    hasToolbar,
    hasWheel,
    hasExport
  });
  
  await browser.close();
}

testRoom().catch(console.error);
