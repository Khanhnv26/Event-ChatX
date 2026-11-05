import { chromium } from '../frontend/node_modules/playwright/index.mjs';

async function testCamera() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:18082');

  // Test injecting camera styling and helper
  await page.evaluate(() => {
    // Inject custom CSS
    const style = document.createElement('style');
    style.id = 'cinematic-styles';
    style.innerHTML = `
      #root {
        transition: transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), filter 0.85s ease;
        transform-origin: 50% 50%;
        will-change: transform;
      }
      .cinematic-hud {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 99999;
      }
      .cinematic-lower-third {
        position: absolute;
        bottom: 36px;
        left: 48px;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.2);
        padding: 16px 28px;
        border-radius: 16px;
        color: white;
        font-family: Inter, system-ui, sans-serif;
        display: flex;
        align-items: center;
        gap: 18px;
        transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        transform: translateY(0);
        opacity: 1;
      }
      .badge-step {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.5px;
        padding: 6px 12px;
        border-radius: 8px;
        text-transform: uppercase;
      }
      .lower-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.3px;
        margin-bottom: 2px;
      }
      .lower-sub {
        font-size: 12px;
        color: #94a3b8;
      }
    `;
    document.head.appendChild(style);

    const hud = document.createElement('div');
    hud.className = 'cinematic-hud';
    hud.innerHTML = `
      <div id="cine-lt" class="cinematic-lower-third">
        <div class="badge-step">01 / KHỞI TẠO</div>
        <div>
          <div class="lower-title">Tạo phòng thảo luận tức thì</div>
          <div class="lower-sub">Zero-Login · Không cần đăng ký · Chia sẻ mã phòng tức thì</div>
        </div>
      </div>
    `;
    document.body.appendChild(hud);
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/test-camera-hud.png' });
  console.log('Saved test-camera-hud.png');
  await browser.close();
}

testCamera().catch(console.error);
