import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode } from 'lucide-react';
import { toast } from '../../stores/toastStore';
import { ModalPortal } from '../common/ModalPortal';

interface RoomQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomTitle: string;
  roomCode: string;
}

export const RoomQrModal: React.FC<RoomQrModalProps> = ({
  isOpen,
  onClose,
  roomTitle,
  roomCode,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  if (!isOpen) return null;

  const fullUrl = `${window.location.origin}/rooms/${roomCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Đã sao chép liên kết phòng vào bộ nhớ tạm');
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Không thể sao chép liên kết, hãy thử lại'); }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="motion-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          data-native-scroll className="motion-dialog w-full max-w-sm overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative flex flex-col items-center text-center space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <QrCode className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <h3 id="qr-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Quét mã tham gia phòng
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[260px]">
              {roomTitle}
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-inner">
            <QRCodeSVG
              value={fullUrl}
              size={190}
              level="M"
              includeMargin
              className="rounded-lg"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80">
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
              #{roomCode}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Mở camera trên điện thoại để quét mã và vào phòng ngay lập tức.
          </p>

          <div className="w-full flex items-center gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Đã sao chép liên kết</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao chép liên kết</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
