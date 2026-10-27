import React, { useState } from 'react';
import { UserCheck } from 'lucide-react';

interface JoinRoomModalProps {
  isOpen: boolean;
  slug: string;
  onJoin: (nickname: string) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ isOpen, slug, onJoin }) => {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Vui lòng nhập biệt danh');
      return;
    }
    onJoin(nickname.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative animate-scale-up text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3">
          <UserCheck className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Tham gia phòng sự kiện</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Mã phòng: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{slug}</span>
        </p>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError('');
            }}
            placeholder="Nhập biệt danh của bạn (VD: Minh Tuấn)..."
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-medium"
          />

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all cursor-pointer active:scale-95"
          >
            Vào phòng ngay
          </button>
        </form>
      </div>
    </div>
  );
};
