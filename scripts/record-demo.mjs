import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.EVENTCHAT_URL || 'http://127.0.0.1:18082';
const VIDEO_DIR = path.resolve('artifacts/videos');

async function showBanner(page, text) {
  await page.evaluate((msg) => {
    let el = document.getElementById('demo-feature-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-feature-banner';
      el.style.position = 'fixed';
      el.style.bottom = '28px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.zIndex = '99999';
      el.style.padding = '12px 28px';
      el.style.borderRadius = '9999px';
      el.style.background = 'rgba(15, 23, 42, 0.94)';
      el.style.backdropFilter = 'blur(16px)';
      el.style.border = '1px solid rgba(99, 102, 241, 0.5)';
      el.style.boxShadow = '0 12px 30px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.3)';
      el.style.color = '#ffffff';
      el.style.fontSize = '14px';
      el.style.fontWeight = '600';
      el.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
      el.style.letterSpacing = '0.01em';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '12px';
      el.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:#818cf8; box-shadow:0 0 10px #818cf8;"></span>
      <span>${msg}</span>
    `;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  }, text);
}

async function hideBanner(page) {
  await page.evaluate(() => {
    const el = document.getElementById('demo-feature-banner');
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(12px)';
    }
  });
}

async function naturalType(page, selector, text) {
  await page.click(selector);
  await page.fill(selector, '');
  await page.type(selector, text, { delay: 18 });
}

async function run() {
  await mkdir(VIDEO_DIR, { recursive: true });

  console.log('🎬 Khởi chạy Chromium ghi hình video demo EventChat...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome'
  });

  const hostContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1280, height: 720 }
    }
  });

  const memberContext = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await hostContext.newPage();
  const pageMember = await memberContext.newPage();

  console.log('1. Trang chủ Landing Page...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await showBanner(page, 'EventChat · Nền tảng điều phối sự kiện thời gian thực');
  await page.waitForTimeout(2500);

  console.log('2. Tạo phòng họp mới...');
  await showBanner(page, 'Khởi tạo phòng thảo luận tức thì (Zero-Login, Không cần tài khoản)');
  await naturalType(page, '#create-room-title', 'Workshop: Kiến trúc Modular Monolith & Living Tools');
  await page.waitForTimeout(1000);
  
  // Click submit button for create room
  await page.click('button[form="form-create-room"]');

  await page.waitForURL(/\/rooms\/.+/, { timeout: 15000 });
  const roomUrl = page.url();
  const roomSlug = roomUrl.split('/rooms/')[1].split('?')[0];
  console.log(`✅ Host đã tạo phòng thành công: ${roomSlug}`);
  await page.waitForTimeout(2000);

  console.log('3. Thành viên tham gia phòng...');
  await showBanner(page, 'Thành viên tham gia phòng theo thời gian thực qua mã phòng');
  await pageMember.goto(`${BASE_URL}/rooms/${roomSlug}`, { waitUntil: 'domcontentloaded' });
  
  // Explicitly target the nickname input in JoinRoomModal
  const joinInput = pageMember.locator('input[aria-label="Biệt danh của bạn"]');
  await joinInput.waitFor({ state: 'visible', timeout: 10000 });
  await joinInput.fill('Mai Linh (Kỹ sư phần mềm)');
  await pageMember.waitForTimeout(600);
  await pageMember.click('button[type="submit"]:has-text("Vào phòng ngay")');
  await joinInput.waitFor({ state: 'hidden', timeout: 8000 });
  console.log('✅ Thành viên Mai Linh đã vào phòng!');

  // Host sees member joined
  await page.waitForTimeout(2000);

  console.log('4. Chat thời gian thực...');
  await showBanner(page, 'Trò chuyện thời gian thực qua WebSocket & STOMP Broker');
  await naturalType(page, 'input[placeholder="Nhập tin nhắn thảo luận..."]', 'Chào mừng các bạn đã đến với buổi Workshop EventChat hôm nay! 🎉');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // Member sends response
  await naturalType(pageMember, 'input[placeholder="Nhập tin nhắn thảo luận..."]', 'Chào anh Alex và mọi người! Em rất mong chờ phần trải nghiệm Living Tools.');
  await pageMember.waitForTimeout(600);
  await pageMember.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  console.log('5. Thảo luận nhánh (Threaded Chat Branches)...');
  await showBanner(page, 'Thảo luận nhánh (Threaded Chat) · Tập trung đào sâu, không loãng kênh chính');
  await naturalType(pageMember, 'input[placeholder="Nhập tin nhắn thảo luận..."]', 'Cho em hỏi về kiến trúc Modular Monolith và Spring Boot 3 với ạ?');
  await pageMember.waitForTimeout(500);
  await pageMember.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // Host opens thread for that message
  const threadBtn = page.locator('button:has-text("Thảo luận nhánh")').last();
  if (await threadBtn.count() > 0) {
    await threadBtn.click();
    await page.waitForTimeout(1500);

    const threadInput = page.locator('#thread-message');
    if (await threadInput.count() > 0) {
      await naturalType(page, '#thread-message', 'Mô hình này đóng gói nguyên khối nhưng phân tách domain độc lập, cực kỳ tối ưu cho MVP!');
      await page.waitForTimeout(800);
      await page.click('button[type="submit"]:has-text("Gửi phản hồi")');
      await page.waitForTimeout(2000);
    }

    const closeThreadBtn = page.locator('button[aria-label="Đóng nhánh thảo luận"]');
    if (await closeThreadBtn.count() > 0) {
      await closeThreadBtn.click();
      await page.waitForTimeout(1200);
    }
  }

  console.log('6. Tạo cuộc bình chọn (Live Poll)...');
  await showBanner(page, 'Living Tools: Tạo biểu quyết & cập nhật số liệu trực tiếp');
  await page.click('button[title="Danh sách bình chọn"]');
  await page.waitForTimeout(1000);
  
  const createPollBtn = page.getByRole('dialog').getByRole('button', { name: 'Tạo bình chọn' });
  if (await createPollBtn.count() > 0) {
    await createPollBtn.click();
    await page.waitForTimeout(1000);
  }

  const pollQuestionInput = page.locator('input[placeholder*="Chiều nay liên hoan"], input[placeholder*="Câu hỏi"]').first();
  await pollQuestionInput.waitFor({ state: 'visible', timeout: 8000 });
  await naturalType(page, 'input[placeholder*="Chiều nay liên hoan"], input[placeholder*="Câu hỏi"]', 'Mô hình kiến trúc nào tối ưu nhất cho MVP?');
  
  await naturalType(page, 'input[placeholder="Lựa chọn 1"]', 'Modular Monolith (Triển khai 1 container)');
  await naturalType(page, 'input[placeholder="Lựa chọn 2"]', 'Microservices độc lập (K8s)');
  await page.waitForTimeout(800);
  
  await page.click('button[type="submit"]:has-text("Tạo bình chọn")');
  await page.waitForTimeout(2500);

  console.log('7. Thành viên bình chọn...');
  await showBanner(page, 'Bình chọn tức thì · Hiển thị tỷ lệ & thanh tiến độ theo thời gian thực');
  const pollOption = page.locator('label:has-text("Modular Monolith") input[type="radio"], label:has-text("Modular Monolith")').first();
  if (await pollOption.count() > 0) {
    await pollOption.click();
    await page.waitForTimeout(600);
    const voteBtn = page.locator('button:has-text("Gửi phiếu")').first();
    if (await voteBtn.count() > 0) {
      await voteBtn.click();
    }
    await page.waitForTimeout(1500);
  }

  // Member votes
  const memberPollOption = pageMember.locator('label:has-text("Modular Monolith") input[type="radio"], label:has-text("Modular Monolith")').first();
  if (await memberPollOption.count() > 0) {
    await memberPollOption.click();
    await pageMember.waitForTimeout(600);
    const memberVoteBtn = pageMember.locator('button:has-text("Gửi phiếu")').first();
    if (await memberVoteBtn.count() > 0) {
      await memberVoteBtn.click();
    }
    await page.waitForTimeout(2500);
  }

  console.log('8. Vòng quay may mắn (Lucky Wheel)...');
  await showBanner(page, 'Living Tools: Vòng quay may mắn chọn ngẫu nhiên minh bạch');
  const wheelToolbarBtn = page.locator('button:has-text("Vòng quay")').first();
  await wheelToolbarBtn.click();
  await page.waitForTimeout(1500);

  const fillBtn = page.locator('button:has-text("Dùng danh sách thành viên")').first();
  if (await fillBtn.isVisible()) {
    await fillBtn.click();
    await page.waitForTimeout(1000);
    const saveWheelBtn = page.locator('button:has-text("Lưu & Sẵn Sàng Quay")').first();
    await saveWheelBtn.click();
    await page.waitForTimeout(1500);
  }

  const decisionContextInput = page.locator('input[placeholder*="Người bao kèo lẩu"], input[placeholder*="Việc cần quyết định"]').first();
  if (await decisionContextInput.count() > 0) {
    await decisionContextInput.fill('Người phát biểu tổng kết workshop');
    await page.waitForTimeout(600);
  }

  const spinBtn = page.locator('button:has-text("QUAY NGAY")').first();
  if (await spinBtn.count() > 0) {
    await spinBtn.click();
    console.log('🎡 Đang quay thưởng & nổ pháo hoa...');
    await page.waitForTimeout(5500); // Wait for spin animation & confetti

    const makeDecisionFromWheel = page.locator('button:has-text("Tạo đề xuất từ kết quả")').first();
    if (await makeDecisionFromWheel.count() > 0) {
      await makeDecisionFromWheel.click();
      await page.waitForTimeout(1800);
    }
  }

  // Close wheel modal cleanly with Escape key
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);

  console.log('9. Chốt quyết định vào biên bản...');
  await showBanner(page, 'Decision Tracking: Chốt quyết định chính thức cho cuộc họp');
  
  // Add another official decision
  const addDecisionBtn = page.locator('button:has-text("Thêm quyết định"), button:has-text("Đề xuất quyết định")').first();
  if (await addDecisionBtn.count() > 0) {
    await addDecisionBtn.click();
    await page.waitForTimeout(1000);
    const titleInput = page.locator('input[placeholder*="Tiêu đề quyết định"], input[placeholder*="Thống nhất"]').first();
    if (await titleInput.count() > 0) {
      await naturalType(page, 'input[placeholder*="Tiêu đề quyết định"], input[placeholder*="Thống nhất"]', 'Thống nhất áp dụng Modular Monolith cho toàn dự án');
      const detailsInput = page.locator('input[placeholder*="Ghi chú thêm"]').first();
      if (await detailsInput.count() > 0) {
        await detailsInput.fill('Đạt 100% đồng thuận qua biểu quyết của toàn bộ thành viên.');
      }
      await page.waitForTimeout(600);
      const submitDecision = page.locator('button:has-text("Ghim quyết định"), button:has-text("Lưu")').first();
      await submitDecision.click();
      await page.waitForTimeout(1500);
    }
  }

  // Confirm pending decisions
  const confirmBtns = page.locator('button:has-text("Chốt quyết định")');
  const countConfirm = await confirmBtns.count();
  for (let i = 0; i < countConfirm; i++) {
    const btn = page.locator('button:has-text("Chốt quyết định")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  }

  console.log('10. Đính kèm tệp tin...');
  await showBanner(page, 'Đính kèm tệp tin & Hình ảnh trực tiếp vào cuộc trò chuyện');
  const fileInputSelector = 'input[aria-label="Chọn ảnh hoặc tệp"], input[type="file"]';
  if (await page.locator(fileInputSelector).count() > 0 && existsSync('artifacts/attachment-ui-demo.png')) {
    await page.setInputFiles(fileInputSelector, 'artifacts/attachment-ui-demo.png');
    await page.waitForTimeout(1500);
    const chatInputWithFile = page.locator('input[placeholder="Nhập tin nhắn thảo luận..."]');
    await chatInputWithFile.fill('Gửi sơ đồ kiến trúc hệ thống đính kèm nhé mọi người!');
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
  }

  console.log('11. Xuất biên bản sự kiện (Meeting Minutes Export)...');
  await showBanner(page, 'Tự động tổng hợp & Xuất biên bản cuộc họp (Meeting Minutes)');
  const exportBtn = page.locator('button:has-text("Xuất biên bản")').first();
  if (await exportBtn.count() > 0) {
    await exportBtn.click();
    await page.waitForTimeout(2500);

    const markdownTab = page.locator('[role="dialog"]').locator('button:has-text("Markdown")').first();
    if (await markdownTab.count() > 0) {
      await markdownTab.click();
      await page.waitForTimeout(2000);
    }

    const previewTab = page.locator('[role="dialog"]').locator('button:has-text("Xem trước"), button:has-text("preview")').first();
    if (await previewTab.count() > 0) {
      await previewTab.click();
      await page.waitForTimeout(2500);
    }

    const copyBtn = page.locator('[role="dialog"]').locator('button:has-text("Sao chép")').first();
    if (await copyBtn.count() > 0) {
      await copyBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  console.log('12. Hoàn thành ghi hình demo!');
  await showBanner(page, '✨ Hoàn tất Demo: EventChat - Sẵn sàng cho mọi sự kiện tương tác!');
  await page.waitForTimeout(3000);
  await hideBanner(page);
  await page.waitForTimeout(1000);

  const video = page.video();
  const videoPath = await video.path();
  await hostContext.close();
  await memberContext.close();
  await browser.close();

  const finalVideoPath = path.join(VIDEO_DIR, 'eventchat-demo-full.webm');
  if (existsSync(finalVideoPath)) {
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(finalVideoPath);
    } catch {}
  }
  await rename(videoPath, finalVideoPath);
  console.log(`🎉 Video demo đã được ghi lại thành công: ${finalVideoPath}`);
}

run().catch((err) => {
  console.error('Lỗi khi chạy ghi hình demo:', err);
  process.exit(1);
});
