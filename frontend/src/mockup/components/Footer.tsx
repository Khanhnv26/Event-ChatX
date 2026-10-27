import React from 'react';
import {
  MessageSquareCode,
  ShieldCheck,
  Zap,
  Sparkles,
  MessageCircle,
  BarChart2,
  Disc,
  FileCheck2,
  CheckCircle,
  Clock,
  KeyRound,
} from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-colors relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <MessageSquareCode className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                EventChat
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Không gian thảo luận và biểu quyết tức thì cho nhóm bạn, lớp học và sự kiện. Không cần đăng ký, vào là bàn, tự động dọn dẹp sau khi kết thúc.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 pt-1">
              <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                <Zap className="w-3.5 h-3.5" /> Phản hồi tức thì
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Riêng tư tuyệt đối
              </span>
            </div>
          </div>

          {/* Core Features */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Tính năng chính
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <MessageCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Trò chuyện trực tiếp không trôi tin</span>
              </li>
              <li className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <BarChart2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>Bình chọn và biểu quyết ý kiến</span>
              </li>
              <li className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <Disc className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Vòng quay may mắn chọn người ngẫu nhiên</span>
              </li>
              <li className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Ghim và gửi kết quả tóm tắt</span>
              </li>
            </ul>
          </div>

          {/* Privacy Guarantees */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Cam kết người dùng
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Không cần tạo tài khoản hay mật khẩu</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Tự động xoá toàn bộ khi phòng hết hạn</span>
              </li>
              <li className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Chỉ người có mã phòng mới vào được</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} EventChat. Bàn nhanh • Chốt rõ • Chia sẻ ngay.</p>
          <div className="flex items-center gap-1 text-[11px]">
            <span>Đơn giản hoá thảo luận nhóm</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500 ml-0.5" />
          </div>
        </div>
      </div>
    </footer>
  );
};
