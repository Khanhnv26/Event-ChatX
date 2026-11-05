import { chromium } from '../frontend/node_modules/playwright/index.mjs';

async function testHud() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:18082');

  await page.evaluate(() => {
    // Inject styles
    const style = document.createElement('style');
    style.id = 'cine-hud-styles';
    style.innerHTML = `
      #root {
        transition: transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), filter 0.85s ease;
        transform-origin: 50% 50%;
        will-change: transform;
      }
      #cine-hud-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .cine-progress-bar {
        position: absolute;
        top: 18px;
        right: 28px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(14px);
        padding: 5px 12px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      }
      .cine-chapter-pill {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #64748b;
        transition: all 0.4s ease;
      }
      .cine-chapter-pill.active {
        background: rgba(99, 102, 241, 0.25);
        color: #a5b4fc;
        border: 1px solid rgba(129, 140, 248, 0.4);
        box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
      }
      .cine-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #475569;
        transition: all 0.3s ease;
      }
      .cine-chapter-pill.active .cine-dot {
        background: #818cf8;
        box-shadow: 0 0 8px #818cf8;
      }
      #cine-lower-third {
        position: absolute;
        bottom: 24px;
        left: 28px;
        display: flex;
        align-items: center;
        gap: 14px;
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(18px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.6), 0 0 25px rgba(99, 102, 241, 0.2);
        padding: 12px 22px;
        border-radius: 16px;
        transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        transform: translateY(0);
        opacity: 1;
      }
      .cine-badge {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1.2px;
        padding: 5px 10px;
        border-radius: 8px;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
      }
      .cine-title {
        color: #ffffff;
        font-size: 13.5px;
        font-weight: 700;
        letter-spacing: -0.2px;
      }
      .cine-sub {
        color: #94a3b8;
        font-size: 11px;
        font-weight: 500;
      }
      #cine-intro-card {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 50% 40%, rgba(30, 27, 75, 0.98) 0%, rgba(9, 13, 22, 0.99) 70%, #06090e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    const hudRoot = document.createElement('div');
    hudRoot.id = 'cine-hud-root';
    hudRoot.innerHTML = `
      <div class="cine-progress-bar">
        <div class="cine-chapter-pill active" id="pill-1"><span class="cine-dot"></span>01 KHỞI TẠO</div>
        <div class="cine-chapter-pill" id="pill-2"><span class="cine-dot"></span>02 ĐA LUỒNG</div>
        <div class="cine-chapter-pill" id="pill-3"><span class="cine-dot"></span>03 LIGHT & DARK</div>
        <div class="cine-chapter-pill" id="pill-4"><span class="cine-dot"></span>04 BÌNH CHỌN</div>
        <div class="cine-chapter-pill" id="pill-5"><span class="cine-dot"></span>05 VÒNG QUAY</div>
        <div class="cine-chapter-pill" id="pill-6"><span class="cine-dot"></span>06 BIÊN BẢN</div>
      </div>
      <div id="cine-lower-third">
        <div class="cine-badge">01 / KHỞI TẠO</div>
        <div>
          <div class="cine-title">Tạo phòng thảo luận tức thì</div>
          <div class="cine-sub">Zero-Login · Không cần đăng ký · Chia sẻ mã phòng tức thì</div>
        </div>
      </div>
    `;
    document.body.appendChild(hudRoot);
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/test-hud-overlay.png' });
  console.log('Saved artifacts/test-hud-overlay.png');
  await browser.close();
}

testHud().catch(console.error);
