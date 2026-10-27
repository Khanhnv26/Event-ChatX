import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Disc,
  Sparkles,
  CheckCircle2,
  RotateCw,
  ShieldCheck,
  Plus,
  Trash2,
  Users,
  Settings2,
} from 'lucide-react';
import type { WheelItem, Participant } from '../types';

interface WheelSpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WheelItem[];
  isHost?: boolean;
  participants?: Participant[];
  onConfirmWinnerAsDecision: (winnerLabel: string) => Promise<boolean> | boolean | void;
  onCreateWheel?: (title: string, entries: string[]) => Promise<unknown>;
  onSpinRemote?: () => Promise<string | null>;
  roomStatus?: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  remoteWinner?: string | null;
}

export const WheelSpinModal: React.FC<WheelSpinModalProps> = ({
  isOpen,
  onClose,
  items,
  isHost = false,
  participants = [],
  onConfirmWinnerAsDecision,
  onCreateWheel,
  onSpinRemote,
  roomStatus = 'ACTIVE',
  remoteWinner,
}) => {
  const [mode, setMode] = useState<'SPIN' | 'SETUP'>('SPIN');
  const [wheelTitle, setWheelTitle] = useState('Vòng quay chọn ngẫu nhiên');
  const [setupEntries, setSetupEntries] = useState<string[]>(['', '']);
  const [isSubmittingWheel, setIsSubmittingWheel] = useState(false);
  const [setupError, setSetupError] = useState('');

  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [localWinner, setWinner] = useState<string | null>(null);
  const winner = isHost ? localWinner : remoteWinner ?? localWinner;
  const [spinError, setSpinError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (items.length === 0 && isHost) {
        setMode('SETUP');
        if (participants.length > 0) {
          setSetupEntries(participants.map((p) => p.nickname));
        }
      } else {
        setMode('SPIN');
      }
    }
  }, [isOpen, items.length, participants, isHost]);

  if (!isOpen) return null;

  const numItems = Math.max(1, items.length);
  const sliceAngle = 360 / numItems;

  const handleFillFromParticipants = () => {
    if (participants.length === 0) {
      setSetupError('Chưa có thành viên nào trong phòng');
      return;
    }
    setSetupEntries(participants.map((p) => p.nickname));
    setSetupError('');
  };

  const handleAddEntry = () => {
    if (setupEntries.length >= 20) return;
    setSetupEntries((prev) => [...prev, '']);
  };

  const handleRemoveEntry = (idx: number) => {
    if (setupEntries.length <= 2) return;
    setSetupEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEntryChange = (idx: number, val: string) => {
    setSetupEntries((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const handleSaveWheel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost || roomStatus !== 'ACTIVE' || isSubmittingWheel) return;
    const clean = setupEntries.map((e) => e.trim()).filter(Boolean);
    if (clean.length < 2) {
      setSetupError('Cần ít nhất 2 mục lựa chọn hợp lệ');
      return;
    }
    if (!onCreateWheel) {
      setMode('SPIN');
      return;
    }

    setIsSubmittingWheel(true);
    setSetupError('');
    try {
      await onCreateWheel(wheelTitle.trim() || 'Vòng quay ngẫu nhiên', clean);
      setMode('SPIN');
    } catch (err: unknown) {
      const e = err as Error;
      setSetupError(e.message || 'Không thể tạo vòng quay');
    } finally {
      setIsSubmittingWheel(false);
    }
  };

  const handleSpin = async () => {
    if (isSpinning || items.length === 0 || !isHost || roomStatus !== 'ACTIVE') return;

    setIsSpinning(true);
    setWinner(null);
    setSpinError('');

    let targetWinner = '';
    let targetIndex = 0;

    try {
      const result = await onSpinRemote?.();
      if (!result) throw new Error('Không nhận được kết quả vòng quay từ máy chủ');
      targetIndex = items.findIndex(item => item.label === result);
      if (targetIndex < 0) throw new Error('Danh sách vòng quay đã thay đổi. Vui lòng tải lại phòng.');
      targetWinner = result;
    } catch (err) {
      setSpinError(err instanceof Error ? err.message : 'Không thể quay');
      setIsSpinning(false);
      return;
    }

    const extraRounds = 5 + Math.floor(Math.random() * 3);
    const targetSliceCenter = targetIndex * sliceAngle + sliceAngle / 2;
    const stopAngle = 360 * extraRounds + (360 - targetSliceCenter + 270) % 360;

    const newTotalRotation = rotation - (rotation % 360) + stopAngle;
    setRotation(newTotalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setWinner(targetWinner || items[targetIndex].label);

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'],
      });
    }, 4000);
  };

  const handleMakeDecision = async () => {
    if (winner) {
      if (await onConfirmWinnerAsDecision(winner) === false) return;
      onClose();
    }
  };

  return (
    <div className="motion-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="motion-dialog relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 overflow-hidden text-center max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          disabled={isSpinning}
          aria-label="Close"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-1 shrink-0">
          <Disc className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {mode === 'SETUP' ? 'Cấu Hình Vòng Quay' : 'Vòng Quay Quyết Định Ngẫu Nhiên'}
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 shrink-0">
          {mode === 'SETUP'
            ? 'Nhập danh sách các lựa chọn hoặc chọn nhanh từ danh sách thành viên trong phòng'
            : 'Đồng bộ thời gian thực kết quả cho toàn bộ thành viên'}
        </p>

        {spinError && <p role="alert" className="text-xs text-rose-600 mb-3">{spinError}</p>}
        {mode === 'SETUP' ? (
          <form onSubmit={handleSaveWheel} className="flex-1 overflow-y-auto pr-1 text-left space-y-4">
            {setupError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {setupError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Tiêu đề vòng quay
              </label>
              <input
                type="text"
                value={wheelTitle}
                onChange={(e) => setWheelTitle(e.target.value)}
                placeholder="VD: Ai là người chốt hoá đơn?"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Các mục quay (tối thiểu 2)
                </label>
                <button
                  type="button"
                  onClick={handleFillFromParticipants}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 cursor-pointer active:scale-95"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Dùng danh sách thành viên ({participants.length})</span>
                </button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {setupEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={entry}
                      onChange={(e) => handleEntryChange(idx, e.target.value)}
                      placeholder={`Lựa chọn ${idx + 1}`}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {setupEntries.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(idx)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {setupEntries.length < 20 && (
                <button
                  type="button"
                  onClick={handleAddEntry}
                  className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm mục khác</span>
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode('SPIN')}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Quay lại
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmittingWheel || roomStatus !== 'ACTIVE'}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer shadow-md shadow-indigo-500/25 disabled:opacity-50"
              >
                {isSubmittingWheel ? 'Đang lưu...' : 'Lưu & Sẵn Sàng Quay'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                {items.length} lựa chọn
              </span>
              {isHost && (
                <button
                  onClick={() => setMode('SETUP')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 cursor-pointer active:scale-95"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Cấu hình mục quay</span>
                </button>
              )}
            </div>

            <div className="relative w-72 h-72 sm:w-80 sm:h-80 mx-auto my-2 flex items-center justify-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-rose-500 filter drop-shadow-md" />

              <div
                className="w-full h-full rounded-full shadow-2xl border-4 border-white dark:border-slate-800 overflow-hidden relative"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: isSpinning
                    ? 'transform 4s cubic-bezier(0.15, 0.9, 0.2, 1)'
                    : 'none',
                }}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {items.map((item, idx) => {
                    const startAngle = (idx * 360) / numItems;
                    const endAngle = ((idx + 1) * 360) / numItems;

                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;

                    const x1 = 50 + 50 * Math.cos(startRad);
                    const y1 = 50 + 50 * Math.sin(startRad);
                    const x2 = 50 + 50 * Math.cos(endRad);
                    const y2 = 50 + 50 * Math.sin(endRad);

                    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                    const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;

                    const midAngle = (startAngle + endAngle) / 2;
                    const textRad = (midAngle * Math.PI) / 180;
                    const textX = 50 + 32 * Math.cos(textRad);
                    const textY = 50 + 32 * Math.sin(textRad);

                    return (
                      <g key={item.id}>
                        <path d={pathData} fill={item.color} stroke="#ffffff" strokeWidth="0.8" />
                        <text
                          x={textX}
                          y={textY}
                          fill="#ffffff"
                          fontSize="4.2"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                          className="select-none drop-shadow"
                        >
                          {item.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white dark:bg-slate-900 border-4 border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </div>

            <div className="mt-4 min-h-[80px] flex flex-col items-center justify-center">
              {winner ? (
                <div className="w-full p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>KẾT QUẢ ĐÃ CHỐT</span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                    🎉 {winner} 🎉
                  </p>
                  <button
                    onClick={handleMakeDecision}
                    className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2 mx-auto cursor-pointer transition-transform hover:scale-105"
                  >
                    <span>Chốt "{winner}" vào Thẻ Quyết Định</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  {isSpinning
                    ? 'Đang quay ngẫu nhiên... Xin chờ trong giây lát!'
                    : `Sẵn sàng quay ${items.length} mục`}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={handleSpin}
                disabled={isSpinning || items.length === 0 || !isHost || roomStatus !== 'ACTIVE'}
                className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'Đang quay ngẫu nhiên...' : 'QUAY NGAY'}</span>
              </button>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Kết quả được tạo ngẫu nhiên minh bạch cho toàn phòng</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
