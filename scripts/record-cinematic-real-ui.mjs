import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.EVENTCHAT_URL || 'http://127.0.0.1:18082';
const VIDEO_DIR = path.resolve('artifacts/videos');
const SOURCE_VIDEO_PATH = path.join(VIDEO_DIR, 'eventchat-real-ui-source.webm');

async function injectCinematicHUD(page) {
  await page.evaluate(() => {
    if (document.getElementById('cine-hud-styles')) return;

    const style = document.createElement('style');
    style.id = 'cine-hud-styles';
    style.innerHTML = `
      #root {
        transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s ease;
        transform-origin: 50% 50%;
        will-change: transform;
      }
      #cine-hud-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #64748b;
        transition: all 0.4s ease;
      }
      .cine-chapter-pill.active {
        background: rgba(99, 102, 241, 0.3);
        color: #c7d2fe;
        border: 1px solid rgba(129, 140, 248, 0.5);
        box-shadow: 0 0 12px rgba(99, 102, 241, 0.35);
      }
      .cine-dot {
        width: 6px;
        height: 6px;
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
        bottom: 26px;
        left: 28px;
        display: flex;
        align-items: center;
        gap: 15px;
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.6), 0 0 25px rgba(99, 102, 241, 0.25);
        padding: 13px 22px;
        border-radius: 16px;
        transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        transform: translateY(0);
        opacity: 1;
      }
      #cine-lower-third.hidden {
        transform: translateY(24px);
        opacity: 0;
      }
      .cine-badge {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1.2px;
        padding: 5px 11px;
        border-radius: 8px;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
      }
      .cine-title {
        color: #ffffff;
        font-size: 13.5px;
        font-weight: 700;
        letter-spacing: -0.2px;
        margin-bottom: 2px;
      }
      .cine-sub {
        color: #94a3b8;
        font-size: 11px;
        font-weight: 500;
      }
      #cine-intro-card, #cine-outro-card {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 50% 40%, rgba(30, 27, 75, 0.97) 0%, rgba(9, 13, 22, 0.98) 70%, #06090e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1), transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 1;
        z-index: 99999999;
      }
      #cine-intro-card.hidden, #cine-outro-card.hidden {
        opacity: 0;
        transform: scale(1.04);
        pointer-events: none;
      }
      .cine-intro-logo {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 18px;
      }
      .cine-logo-icon {
        width: 52px;
        height: 52px;
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: white;
        font-size: 24px;
        font-weight: 800;
        box-shadow: 0 12px 28px rgba(99, 102, 241, 0.45);
      }
      .cine-intro-title {
        font-size: 48px;
        font-weight: 800;
        letter-spacing: -1.6px;
        color: #ffffff;
        line-height: 1.15;
        margin-bottom: 12px;
      }
      .cine-intro-title span {
        background: linear-gradient(135deg, #a5b4fc, #818cf8, #38bdf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .cine-intro-tagline {
        font-size: 17px;
        color: #94a3b8;
        font-weight: 500;
        letter-spacing: -0.2px;
        max-width: 600px;
        margin-bottom: 28px;
      }
      .cine-feature-chips {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }
      .cine-chip {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.14);
        padding: 7px 15px;
        border-radius: 9999px;
        font-size: 12.5px;
        font-weight: 600;
        color: #e2e8f0;
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .cine-chip-accent {
        color: #38bdf8;
      }
    `;
    document.head.appendChild(style);

    const hudRoot = document.createElement('div');
    hudRoot.id = 'cine-hud-root';
    hudRoot.innerHTML = `
      <div id="cine-intro-card">
        <div class="cine-intro-logo">
          <div class="cine-logo-icon">↗</div>
          <span style="font-size:26px; font-weight:800; color:white; letter-spacing:-0.5px;">EventChat</span>
        </div>
        <div class="cine-intro-title">
          Bàn nhanh. <span>Chốt rõ.</span>
        </div>
        <div class="cine-intro-tagline">
          Nền tảng điều phối sự kiện thời gian thực với bộ công cụ Living Tools tích hợp
        </div>
      </div>

      <div id="cine-outro-card" class="hidden">
        <div class="cine-intro-logo">
          <div class="cine-logo-icon">↗</div>
          <span style="font-size:30px; font-weight:800; color:white; letter-spacing:-0.5px;">EventChat</span>
        </div>
        <div class="cine-intro-title">
          Bàn nhanh. <span>Chốt rõ.</span>
        </div>
        <div class="cine-intro-tagline">
          Một nền tảng toàn diện cho thảo luận liền mạch, ra quyết định minh bạch và xuất biên bản tự động
        </div>
        <div class="cine-feature-chips" style="margin-top: 8px;">
          <div class="cine-chip" style="background: rgba(99, 102, 241, 0.25); border-color: rgba(129, 140, 248, 0.5); color: #c7d2fe; font-size: 14px; padding: 10px 22px;">
            Trải nghiệm ngay tại eventchat.dev
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(hudRoot);
  });
}

async function setChapter(page, chapterNum, badge, title, sub) {
  await page.evaluate(({ num, badge, title, sub }) => {
    // Update pills
    for (let i = 1; i <= 6; i++) {
      const pill = document.getElementById(`pill-${i}`);
      if (pill) {
        if (i === num) pill.classList.add('active');
        else pill.classList.remove('active');
      }
    }

    const lt = document.getElementById('cine-lower-third');
    const badgeEl = document.getElementById('cine-lt-badge');
    const titleEl = document.getElementById('cine-lt-title');
    const subEl = document.getElementById('cine-lt-sub');

    if (lt && badgeEl && titleEl && subEl) {
      lt.classList.add('hidden');
      setTimeout(() => {
        badgeEl.textContent = badge;
        titleEl.textContent = title;
        subEl.textContent = sub;
        lt.classList.remove('hidden');
      }, 250);
    }
  }, { num: chapterNum, badge, title, sub });
}

async function setCameraZoom(page, origin = '50% 50%', scale = 1.0) {
  await page.evaluate(({ origin, scale }) => {
    const root = document.getElementById('root');
    if (root) {
      root.style.transformOrigin = origin;
      root.style.transform = scale === 1.0 ? 'none' : `scale(${scale})`;
    }
  }, { origin, scale });
}

async function hideIntro(page) {
  await page.evaluate(() => {
    const intro = document.getElementById('cine-intro-card');
    if (intro) intro.classList.add('hidden');
  });
}

async function showOutro(page) {
  await page.evaluate(() => {
    const outro = document.getElementById('cine-outro-card');
    const lt = document.getElementById('cine-lower-third');
    const pills = document.querySelector('.cine-progress-bar');
    if (lt) lt.classList.add('hidden');
    if (pills) pills.style.opacity = '0';
    if (outro) outro.classList.remove('hidden');
  });
}

async function naturalType(page, selector, text, delay = 22) {
  await page.click(selector);
  await page.fill(selector, '');
  await page.type(selector, text, { delay });
}

async function run() {
  await mkdir(VIDEO_DIR, { recursive: true });

  console.log('🎬 Khởi chạy Chromium ghi hình Cinematic Real UI...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome'
  });

  const hostContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1920, height: 1080 }
    }
  });

  const memberContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await hostContext.newPage();
  const pageMember = await memberContext.newPage();

  // 1. Landing Page with Intro Card
  console.log('1. Trang chủ & Intro Card...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await injectCinematicHUD(page);
  
  // Display Title Screen for 3.5 seconds
  await page.waitForTimeout(3500);

  // Dissolve Intro Card to reveal real Light Mode landing page
  await hideIntro(page);
  await page.waitForTimeout(1000);

  // Focus camera toward room creation card
  console.log('2. Nhập tiêu đề và tạo phòng...');
  await setCameraZoom(page, '50% 48%', 1.0);
  await page.waitForTimeout(600);

  await naturalType(page, '#create-room-title', 'Workshop: Kiến trúc Modular Monolith & Living Tools', 20);
  await page.waitForTimeout(800);

  // Click Submit
  await page.click('button[form="form-create-room"]');
  await page.waitForURL(/\/rooms\/.+/, { timeout: 15000 });

  const roomUrl = page.url();
  const roomSlug = roomUrl.split('/rooms/')[1].split('?')[0];
  console.log(`✅ Phòng đã tạo thành công: ${roomSlug}`);

  // Re-inject HUD on Room page
  await injectCinematicHUD(page);
  await hideIntro(page);
  await setCameraZoom(page, '50% 50%', 1.0);

  // Chapter 2: Real-time Threaded Chat
  console.log('3. Chapter 2: Thảo luận đa luồng thời gian thực...');
  await setChapter(page, 2, '02 / THẢO LUẬN ĐA LUỒNG', 'Trò chuyện thời gian thực qua WebSocket & STOMP', 'Phân tách nhánh ý kiến chuyên sâu mà không làm loãng kênh chung');
  await page.waitForTimeout(1500);

  // Host sends message
  await naturalType(page, 'input[placeholder="Nhập tin nhắn thảo luận..."]', 'Chào mừng các bạn đã đến với buổi Workshop EventChat hôm nay! 🎉', 18);
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Member joins room
  console.log('  -> Thành viên Mai Linh vào phòng...');
  await pageMember.goto(`${BASE_URL}/rooms/${roomSlug}`, { waitUntil: 'domcontentloaded' });
  const joinInput = pageMember.locator('input[aria-label="Biệt danh của bạn"]');
  await joinInput.waitFor({ state: 'visible', timeout: 10000 });
  await joinInput.fill('Mai Linh (Kỹ sư phần mềm)');
  await pageMember.waitForTimeout(500);
  await pageMember.click('button[type="submit"]:has-text("Vào phòng ngay")');
  await joinInput.waitFor({ state: 'hidden', timeout: 8000 });
  await page.waitForTimeout(1200);

  // Member sends response
  await naturalType(pageMember, 'input[placeholder="Nhập tin nhắn thảo luận..."]', 'Chào anh Alex! Em rất mong chờ trải nghiệm bộ công cụ Living Tools hôm nay.', 16);
  await pageMember.waitForTimeout(300);
  await pageMember.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // Member asks question for thread
  await naturalType(pageMember, 'input[placeholder="Nhập tin nhắn thảo luận..."]', 'Cho em hỏi về kiến trúc Modular Monolith và Spring Boot 3 với ạ?', 16);
  await pageMember.waitForTimeout(300);
  await pageMember.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // Host opens thread
  console.log('  -> Mở Thread Drawer thảo luận nhánh...');
  const threadBtn = page.locator('button:has-text("Thảo luận nhánh")').last();
  if (await threadBtn.count() > 0) {
    await threadBtn.click();
    await page.waitForTimeout(1200);

    const threadInput = page.locator('#thread-message');
    if (await threadInput.count() > 0) {
      await naturalType(page, '#thread-message', 'Mô hình này đóng gói nguyên khối nhưng phân tách domain độc lập, cực kỳ tối ưu cho MVP!', 18);
      await page.waitForTimeout(500);
      await page.click('button[type="submit"]:has-text("Gửi phản hồi")');
      await page.waitForTimeout(1500);
    }

    const closeThreadBtn = page.locator('button[aria-label="Đóng nhánh thảo luận"]');
    if (await closeThreadBtn.count() > 0) {
      await closeThreadBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // Chapter 3: Dynamic Theme Switch (Light Mode -> Dark Mode)
  console.log('4. Chapter 3: Chuyển đổi Light Mode sang Dark Mode...');
  await setChapter(page, 3, '03 / LIGHT & DARK MODE', 'Chuyển đổi giao diện Sáng & Tối linh hoạt', 'Tương thích môi trường làm việc ban ngày và chế độ tập trung ban đêm');
  
  // Camera smooth zoom into top-right navbar theme toggle
  await setCameraZoom(page, '92% 5%', 1.0);
  await page.waitForTimeout(1200);

  // Click theme toggle button
  const themeBtn = page.locator('button[aria-label="Toggle theme"]');
  await themeBtn.click();
  await page.waitForTimeout(1500);

  // Smoothly zoom out to full 3-column view to reveal sleek Dark Mode
  await setCameraZoom(page, '50% 50%', 1.0);
  await page.waitForTimeout(2000);

  // Chapter 4: Living Tools · Live Poll
  console.log('5. Chapter 4: Living Tools - Bình chọn trực tiếp...');
  await setChapter(page, 4, '04 / LIVING TOOLS · BÌNH CHỌN', 'Tạo biểu quyết & Tổng hợp dữ liệu trực tiếp', 'Thanh tiến độ và tỷ lệ biểu quyết cập nhật tức thì qua WebSocket');
  await page.waitForTimeout(1000);

  await page.click('button[title="Danh sách bình chọn"]');
  await page.waitForTimeout(800);

  const createPollBtn = page.getByRole('dialog').getByRole('button', { name: 'Tạo bình chọn' });
  if (await createPollBtn.count() > 0) {
    await createPollBtn.click();
    await page.waitForTimeout(800);
  }

  const pollQuestionInput = page.locator('input[placeholder*="Chiều nay liên hoan"], input[placeholder*="Câu hỏi"]').first();
  await pollQuestionInput.waitFor({ state: 'visible', timeout: 8000 });
  await naturalType(page, 'input[placeholder*="Chiều nay liên hoan"], input[placeholder*="Câu hỏi"]', 'Mô hình kiến trúc nào tối ưu nhất cho MVP?', 16);
  await naturalType(page, 'input[placeholder="Lựa chọn 1"]', 'Modular Monolith (Triển khai 1 container)', 14);
  await naturalType(page, 'input[placeholder="Lựa chọn 2"]', 'Microservices độc lập (K8s)', 14);
  await page.waitForTimeout(600);

  await page.click('button[type="submit"]:has-text("Tạo bình chọn")');
  await page.waitForTimeout(2000);

  // Host votes
  const pollOption = page.getByText('Modular Monolith (Triển khai 1 container)', { exact: true }).first();
  if (await pollOption.count() > 0) {
    await pollOption.click();
    await page.waitForTimeout(500);
    const voteBtn = page.locator('button:has-text("Gửi phiếu")').first();
    if (await voteBtn.count() > 0) {
      await voteBtn.click();
    }
    await page.waitForTimeout(1200);
  }

  // Member votes in real time
  const memberPollOption = pageMember.getByText('Modular Monolith (Triển khai 1 container)', { exact: true }).first();
  if (await memberPollOption.count() > 0) {
    await memberPollOption.click();
    await pageMember.waitForTimeout(500);
    const memberVoteBtn = pageMember.locator('button:has-text("Gửi phiếu")').first();
    if (await memberVoteBtn.count() > 0) {
      await memberVoteBtn.click();
    }
    await page.waitForTimeout(2000);
  }

  // Chapter 5: Living Tools · Lucky Wheel
  console.log('6. Chapter 5: Living Tools - Vòng quay may mắn...');
  await setChapter(page, 5, '05 / LIVING TOOLS · VÒNG QUAY', 'Quay thưởng chọn ngẫu nhiên minh bạch', 'Vòng quay HTML5 Canvas mượt mà cùng hiệu ứng pháo hoa ăn mừng sôi động');
  await page.waitForTimeout(1000);

  const wheelToolbarBtn = page.locator('button:has-text("Vòng quay")').first();
  await wheelToolbarBtn.click();
  await page.waitForTimeout(1200);

  const fillBtn = page.locator('button:has-text("Dùng danh sách thành viên")').first();
  if (await fillBtn.isVisible()) {
    await fillBtn.click();
    await page.waitForTimeout(800);
    const saveWheelBtn = page.locator('button:has-text("Lưu & Sẵn Sàng Quay")').first();
    await saveWheelBtn.click();
    await page.waitForTimeout(1200);
  }

  const decisionContextInput = page.locator('input[placeholder*="Người bao kèo lẩu"], input[placeholder*="Việc cần quyết định"]').first();
  if (await decisionContextInput.count() > 0) {
    await decisionContextInput.fill('Người phát biểu tổng kết workshop');
    await page.waitForTimeout(500);
  }

  const spinBtn = page.locator('button:has-text("QUAY NGAY")').first();
  if (await spinBtn.count() > 0) {
    await spinBtn.click();
    console.log('  -> 🎡 Đang quay thưởng & nổ pháo hoa...');
    await page.waitForTimeout(5000); // Wait for spin animation & confetti

    const makeDecisionFromWheel = page.getByRole('button', { name: /Tạo đề xuất từ kết quả|Chốt.*Thẻ Quyết Định/ }).first();
    if (await makeDecisionFromWheel.count() > 0) {
      await makeDecisionFromWheel.click();
      await page.waitForTimeout(1500);
    }
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Chapter 6: Decision Tracking & Meeting Minutes
  console.log('7. Chapter 6: Chốt quyết định & Xuất biên bản...');
  await setChapter(page, 6, '06 / BIÊN BẢN SỰ KIỆN', 'Chốt quyết định chính thức & Tự động xuất biên bản', 'Lưu vết đồng thuận và tạo báo cáo Markdown hoàn chỉnh trong một cú nhấp');
  await page.waitForTimeout(1000);

  // Confirm pending decisions
  const confirmBtns = page.locator('button:has-text("Chốt quyết định")');
  const countConfirm = await confirmBtns.count();
  for (let i = 0; i < countConfirm; i++) {
    const btn = page.locator('button:has-text("Chốt quyết định")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(800);
    }
  }

  // Open Export Meeting Minutes
  const exportBtn = page.locator('button:has-text("Xuất biên bản")').first();
  if (await exportBtn.count() > 0) {
    await exportBtn.click();
    await page.waitForTimeout(2000);

    const markdownTab = page.locator('[role="dialog"]').locator('button:has-text("Markdown")').first();
    if (await markdownTab.count() > 0) {
      await markdownTab.click();
      await page.waitForTimeout(1500);
    }

    const previewTab = page.locator('[role="dialog"]').locator('button:has-text("Xem trước"), button:has-text("preview")').first();
    if (await previewTab.count() > 0) {
      await previewTab.click();
      await page.waitForTimeout(2000);
    }

    const copyBtn = page.locator('[role="dialog"]').locator('button:has-text("Sao chép")').first();
    if (await copyBtn.count() > 0) {
      await copyBtn.click();
      await page.waitForTimeout(1200);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }

  // Chapter 7: Outro Showcase
  console.log('8. Outro: Kết thúc & Call To Action...');
  await showOutro(page);
  await page.waitForTimeout(4000);

  // Finish Recording
  const video = page.video();
  const videoPath = await video.path();

  await hostContext.close();
  await memberContext.close();
  await browser.close();

  if (existsSync(SOURCE_VIDEO_PATH)) {
    try {
      await unlink(SOURCE_VIDEO_PATH);
    } catch {}
  }
  await rename(videoPath, SOURCE_VIDEO_PATH);
  console.log(`Đã ghi giao diện thật: ${SOURCE_VIDEO_PATH}`);
  if (!process.argv.includes('--raw-only')) {
    await new Promise((resolve, reject) => {
      const renderer = spawn(process.execPath, [path.join(import.meta.dirname, 'render-cinematic-motion.mjs')], {
        stdio: 'inherit', windowsHide: true,
      });
      renderer.on('error', reject);
      renderer.on('close', code => code === 0 ? resolve() : reject(new Error(`3D renderer exited ${code}`)));
    });
  }

}

run().catch((err) => {
  console.error('❌ Lỗi khi ghi hình Cinematic Real UI:', err);
  process.exit(1);
});
