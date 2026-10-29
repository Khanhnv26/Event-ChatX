import React from 'react';
import { AlertTriangle, Lock, X } from 'lucide-react';
import { ModalPortal } from '../common/ModalPortal';

interface CloseRoomConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isClosing?: boolean;
}

export const CloseRoomConfirmModal: React.FC<CloseRoomConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isClosing = false,
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal onClose={onClose} dismissible={!isClosing}>
      <div className="motion-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-room-title"
          data-native-scroll className="motion-dialog w-full max-w-md overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isClosing}
            aria-label="Đóng cửa sổ"
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 id="close-room-title" className="text-base font-bold text-slate-900 dark:text-white">
                Đóng phòng & Khóa kết quả?
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Vùng nguy hiểm · Không thể hoàn tác
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p className="leading-relaxed">
              Khi đóng phòng:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <li>Mọi thành viên sẽ dừng gửi tin nhắn và bình chọn.</li>
              <li>Dữ liệu được giữ tối đa 7 ngày sau khi phòng hết hạn.</li>
              <li>Bạn có thể xem và xuất biên bản tổng kết phiên thảo luận.</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isClosing}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={isClosing}
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isClosing ? 'Đang đóng phòng...' : 'Xác nhận đóng phòng'}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
