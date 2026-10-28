import React, { useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { ModalPortal } from '../../components/common/ModalPortal';

interface JoinRoomModalProps {
  isOpen: boolean;
  slug: string;
  onJoin: (nickname: string) => Promise<void> | void;
  onClose?: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ isOpen, slug, onJoin, onClose }) => {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!nickname.trim()) {
      setError('Vui lòng nhập biệt danh');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try { await onJoin(nickname.trim()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không thể tham gia phòng'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <ModalPortal onClose={onClose} dismissible={!isSubmitting}>
      <div className="motion-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-labelledby="join-room-heading" data-native-scroll className="motion-dialog w-full max-w-sm overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative text-center">
        {onClose && <button type="button" aria-label="Quay lại trang chủ" onClick={onClose} disabled={isSubmitting} className="ws-icon-btn absolute top-4 right-4"><X className="w-5 h-5" /></button>}
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3">
          <UserCheck className="w-6 h-6" />
        </div>

        <h3 id="join-room-heading" className="text-lg font-bold text-slate-900 dark:text-white mb-1">Tham gia phòng sự kiện</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Mã phòng: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{slug}</span>
        </p>

        {error && (
          <div role="alert" className="mb-4 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-[11px] text-slate-500">Tin nhắn và kết quả được lưu tối đa 7 ngày sau khi phòng hết hạn. Host có thể xuất biên bản và thu hồi phiên của thành viên. Biệt danh không phải tài khoản xác thực.</p>
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError('');
            }}
            placeholder="Nhập biệt danh của bạn (VD: Minh Tuấn)..."
            autoFocus
            disabled={isSubmitting}
            aria-label="Biệt danh của bạn"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-medium"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all cursor-pointer active:scale-95"
          >
            {isSubmitting ? 'Đang tham gia…' : 'Vào phòng ngay'}
          </button>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
