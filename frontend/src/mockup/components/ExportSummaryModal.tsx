import React, { useState } from 'react';
import {
  FileText,
  Check,
  CheckCircle2,
  Calendar,
  Download,
  Share2,
  ArrowLeft,
} from 'lucide-react';
import type { DecisionCard, Poll, Participant, RoomStatus } from '../types';

interface ExportSummaryModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  roomTitle: string;
  roomCode: string;
  roomStatus: RoomStatus;
  participantsCount?: number;
  decisionsCount?: number;
  decisions: DecisionCard[];
  poll: Poll;
  participants?: Participant[];
  onBackToRoom?: () => void;
  onToggleRoomStatus?: () => void;
}

// Official Brand SVG Icons
const ZaloIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 2C6.48 2 2 6.13 2 11.23c0 2.96 1.52 5.6 3.9 7.32L5 22l3.87-1.8c1 .35 2.06.54 3.13.54 5.52 0 10-4.13 10-9.23C22 6.13 17.52 2 12 2z"
      fill="#0068FF"
    />
    <path
      d="M8.5 9h7c.4 0 .7.3.5.7l-4.7 5.3h4.2c.3 0 .5.2.5.5s-.2.5-.5.5h-7c-.4 0-.7-.3-.5-.7l4.7-5.3H8.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5z"
      fill="#FFFFFF"
    />
  </svg>
);

const MessengerIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.454 5.512 3.736 7.202V22l3.39-1.861c.905.251 1.868.388 2.874.388 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2z"
      fill="url(#messenger-grad)"
    />
    <path
      d="M13.002 14.443l-2.564-2.735-5.004 2.735 5.504-5.843 2.628 2.735 4.94-2.735-5.504 5.843z"
      fill="#FFFFFF"
    />
    <defs>
      <linearGradient id="messenger-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00B2FF" />
        <stop offset="0.5" stopColor="#006AFF" />
        <stop offset="1" stopColor="#9900FF" />
      </linearGradient>
    </defs>
  </svg>
);

const TelegramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" fill="#24A1DE" />
    <path
      d="M16.64 8.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
      fill="#FFFFFF"
    />
  </svg>
);

export const ExportSummaryModal: React.FC<ExportSummaryModalProps> = ({
  isOpen = false,
  onClose,
  roomTitle,
  roomCode,
  decisions,
  poll,
  participants = [],
  onBackToRoom,
  roomStatus,
}) => {
  const [copiedType, setCopiedType] = useState<'ZALO' | 'MESSENGER' | 'TELEGRAM' | 'MARKDOWN' | null>(null);
  if (!isOpen) return null;

  const confirmedDecisions = decisions.filter((d) => d.status === 'CONFIRMED');

  const generateZaloText = () => {
    let text = `📋 [EVENTCHAT] BIÊN BẢN CHỐT VIỆC\n`;
    text += `📌 Chủ đề: ${roomTitle}\n`;
    text += `🔑 Mã phòng: #${roomCode} | ${participants.length} thành viên tham gia\n`;
    text += `⏱ Thời gian chốt: 26/10/2026\n\n`;

    text += `✅ CÁC QUYẾT ĐỊNH ĐÃ THỐNG NHẤT:\n`;
    confirmedDecisions.forEach((dec, idx) => {
      text += `${idx + 1}. ${dec.title}\n   ↳ ${dec.details || ''} (Căn cứ: ${dec.evidenceRef || 'Đồng thuận'})\n`;
    });

    text += `\n📊 KẾT QUẢ BÌNH CHỌN (${poll.question}):\n`;
    poll.options.forEach((opt) => {
      const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
      text += `• ${opt.text}: ${opt.votes} phiếu (${pct}%)\n`;
    });

    text += `\n--- Được tạo bởi EventChat - Bàn nhanh. Chốt rõ. Chia sẻ ngay ---`;
    return text;
  };

  const generateMarkdownText = () => {
    let md = `# 📋 Biên Bản Chốt Việc - ${roomTitle}\n\n`;
    md += `* **Mã phòng:** \`${roomCode}\`\n`;
    md += `* **Trạng thái:** ${roomStatus}\n`;
    md += `* **Số thành viên:** ${participants.length}\n`;
    md += `* **Thời điểm xuất:** 26/10/2026\n\n`;

    md += `## ✅ Danh sách Quyết định đã Xác nhận\n\n`;
    confirmedDecisions.forEach((dec, idx) => {
      md += `### ${idx + 1}. ${dec.title}\n`;
      md += `- **Chi tiết:** ${dec.details || 'N/A'}\n`;
      md += `- **Căn cứ:** \`${dec.evidenceType}\` (${dec.evidenceRef || 'Đồng thuận nhóm'})\n`;
      md += `- **Xác nhận bởi:** ${dec.confirmedBy} lúc ${dec.confirmedAt || '17:20'}\n\n`;
    });

    md += `## 📊 Kết quả Bình chọn: ${poll.question}\n\n`;
    poll.options.forEach((opt) => {
      const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
      md += `- **${opt.text}**: ${opt.votes} phiếu (${pct}%)\n`;
    });

    return md;
  };

  const handleCopy = (type: 'ZALO' | 'MESSENGER' | 'TELEGRAM' | 'MARKDOWN') => {
    const content = type === 'MARKDOWN' ? generateMarkdownText() : generateZaloText();
    navigator.clipboard.writeText(content);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 3000);
  };

  const handleShare = async (platform: 'ZALO' | 'MESSENGER' | 'TELEGRAM' | 'NATIVE') => {
    const text = generateZaloText();
    const shareUrl = `https://eventchat.app/join/${roomCode}`;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
    }

    setCopiedType(platform === 'NATIVE' ? 'ZALO' : platform);
    setTimeout(() => setCopiedType(null), 3000);

    if (platform === 'TELEGRAM') {
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
      window.open(tgUrl, '_blank', 'noopener,noreferrer');
    } else if (platform === 'ZALO') {
      const zaloUrl = `https://sp.zalo.me/plugins/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(roomTitle)}`;
      window.open(zaloUrl, '_blank', 'noopener,noreferrer');
    } else if (platform === 'MESSENGER') {
      if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
        try {
          await navigator.share({
            title: `Biên bản: ${roomTitle}`,
            text: text,
            url: shareUrl,
          });
          return;
        } catch {
        }
      }
      const fbUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(window.location.href)}`;
      window.open(fbUrl, '_blank', 'noopener,noreferrer');
    } else if (platform === 'NATIVE') {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Biên bản: ${roomTitle}`,
            text: text,
            url: shareUrl,
          });
        } catch {
        }
      }
    }
  };

  const handleDownload = () => {
    const content = generateZaloText();
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `EventChat_${roomCode}_BienBan.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="motion-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md p-4 sm:p-6 md:p-8 flex items-center justify-center">
      <div className="motion-dialog w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative space-y-5">
        {/* Top Navigation */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10 -mt-2 pt-2">
          <button
            onClick={() => {
              if (onClose) onClose();
              else if (onBackToRoom) onBackToRoom();
            }}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Quay lại phòng thảo luận</span>
          </button>

          {/* Room Status Pill */}
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2 shadow-2xs ${
              roomStatus === 'CLOSED'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                roomStatus === 'CLOSED' ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
            <span>{roomStatus === 'CLOSED' ? 'Đã đóng phòng' : 'Đang hoạt động'}</span>
          </div>
        </div>

        {/* 1. Header Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 shadow-xs space-y-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              #{roomCode}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> 26/10/2026
            </span>
            <span>•</span>
            <span>{participants.length} thành viên</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
            {roomTitle}
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {confirmedDecisions.length} quyết định đã chốt • {poll.totalVotes} lượt bình chọn
          </p>
        </div>

        {/* 2. Confirmed Decisions List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Các quyết định đã chốt
            </h2>
          </div>

          {confirmedDecisions.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              Chưa có quyết định nào được xác nhận.
            </div>
          ) : (
            <div className="space-y-2.5">
              {confirmedDecisions.map((dec) => (
                <div
                  key={dec.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {dec.title}
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
                      CONFIRMED
                    </span>
                  </div>
                  {dec.details && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {dec.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Direct Share Hub */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-700/80 space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Chia sẻ biên bản</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Mở ứng dụng để gửi biên bản vào nhóm chat của bạn
            </p>
          </div>

          {/* Live Text Preview Box */}
          <div className="relative">
            <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-40 border border-slate-800 select-all">
              {generateZaloText()}
            </pre>
          </div>

          {/* Dedicated Brand Direct Share Buttons Row */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => handleShare('ZALO')}
                className="py-2 px-3 rounded-xl font-bold text-xs text-white bg-[#0068FF] hover:bg-[#0056D2] active:scale-[0.98] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer group"
              >
                <ZaloIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>{copiedType === 'ZALO' ? 'Đang mở Zalo...' : 'Gửi qua Zalo'}</span>
              </button>

              <button
                onClick={() => handleShare('MESSENGER')}
                className="py-2 px-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#0084FF] via-[#7B2CBF] to-[#E0247C] hover:opacity-95 active:scale-[0.98] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer group"
              >
                <MessengerIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>{copiedType === 'MESSENGER' ? 'Đang mở Messenger...' : 'Gửi qua Messenger'}</span>
              </button>

              <button
                onClick={() => handleShare('TELEGRAM')}
                className="py-2 px-3 rounded-xl font-bold text-xs text-white bg-[#24A1DE] hover:bg-[#1f8ebd] active:scale-[0.98] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer group"
              >
                <TelegramIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>{copiedType === 'TELEGRAM' ? 'Đang mở Telegram...' : 'Gửi qua Telegram'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={() => handleCopy('MARKDOWN')}
                className="flex-1 min-w-[160px] py-2 px-3 rounded-lg font-semibold text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                {copiedType === 'MARKDOWN' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Đã chép Markdown</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sao chép Markdown</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                className="py-2 px-3 rounded-lg font-semibold text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Tải file .TXT</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
