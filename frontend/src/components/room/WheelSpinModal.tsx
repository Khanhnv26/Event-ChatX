import React, { useState, useEffect, useRef } from 'react';
import { isMotionEnabled } from '../../services/motionPreference';
import type { WheelResponse, WheelSpinResponse } from '../../types/backend.types';
import { ModalPortal } from '../common/ModalPortal';
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
import type { WheelItem, Participant } from '../../types/room';

const SPIN_DURATION_MS = 4000;

interface WheelSpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WheelItem[];
  isHost?: boolean;
  participants?: Participant[];
  onConfirmWinnerAsDecision: (winnerLabel: string, context: string, spinId: number) => Promise<boolean> | boolean | void;
  savedSpinIds?: number[];
  onCreateWheel?: (title: string, entries: string[], excludeWinner: boolean) => Promise<unknown>;
  onSpinRemote?: () => Promise<string | WheelSpinResponse | null>;
  roomStatus?: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  remoteWinner?: string | null;
  wheelList?: WheelResponse[];
  currentWheelId?: number;
  onSelectWheel?: (id: number) => void;
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
  wheelList = [],
  currentWheelId,
  onSelectWheel,
  savedSpinIds = [],
}) => {
  const [mode, setMode] = useState<'SPIN' | 'SETUP'>(() => items.length === 0 && wheelList.length === 0 && isHost ? 'SETUP' : 'SPIN');
  const [wheelTitle, setWheelTitle] = useState('Vòng quay chọn ngẫu nhiên');
  const [setupEntries, setSetupEntries] = useState<string[]>(() => participants.length >= 2 ? participants.map(p => p.nickname) : ['', '']);
  const [isSubmittingWheel, setIsSubmittingWheel] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [excludeWinner, setExcludeWinner] = useState(false);

  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [localWinner, setWinner] = useState<string | null>(null);
  const winner = isSpinning ? null : localWinner ?? remoteWinner;
  const [spinError, setSpinError] = useState('');
  const [spinItems, setSpinItems] = useState<WheelItem[] | null>(null);
  const spinInFlight = useRef(false);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishSpin = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const selectedWheel = wheelList.find(w => w.id === currentWheelId);
  const [decisionContext, setDecisionContext] = useState('');
  const [localSpinId, setLocalSpinId] = useState<number | null>(null);
  const [savingDecision, setSavingDecision] = useState(false);
  const [savedLocally, setSavedLocally] = useState<number[]>([]);
  const decisionPending = useRef(false);
  const spinId = localWinner ? localSpinId : selectedWheel?.spins[0]?.id;
  const alreadySaved = spinId != null && (savedSpinIds.includes(spinId) || savedLocally.includes(spinId));
  const displayItems = spinItems ?? items;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (spinTimer.current) clearTimeout(spinTimer.current);
      finishSpin.current = null;
    };
  }, []);

  if (!isOpen) return null;

  const numItems = Math.max(1, displayItems.length);

  const handleFillFromParticipants = () => {
    if (participants.length === 0) {
      setSetupError('Chưa có thành viên nào trong phòng');
      return;
    }
    setSetupEntries(participants.length === 1 ? [participants[0].nickname, ''] : participants.map((p) => p.nickname));
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
      await onCreateWheel(wheelTitle.trim() || 'Vòng quay ngẫu nhiên', clean, excludeWinner);
      setSpinItems(null);
      setWinner(null);
      setRotation(0);
      setMode('SPIN');
    } catch (err: unknown) {
      const e = err as Error;
      setSetupError(e.message || 'Không thể tạo vòng quay');
    } finally {
      setIsSubmittingWheel(false);
    }
  };

  const handleSpin = async () => {
    if (spinInFlight.current || decisionPending.current || items.length === 0 || !isHost || roomStatus !== 'ACTIVE') return;

    spinInFlight.current = true;
    const snapshot = [...items];
    setSpinItems(snapshot);
    setIsSpinning(true);
    setWinner(null);
    setSpinError('');

    let targetWinner = '';
    let targetIndex = 0;

    try {
      const result = await onSpinRemote?.();
      if (!mounted.current) return;
      if (!result) throw new Error('Không nhận được kết quả vòng quay từ máy chủ');
      const label = typeof result === 'string' ? result : result.resultEntry;
      setLocalSpinId(typeof result === 'string' ? null : result.id);
      targetIndex = snapshot.findIndex(item => item.label === label);
      if (targetIndex < 0) throw new Error('Danh sách vòng quay đã thay đổi. Vui lòng tải lại phòng.');
      targetWinner = label;
    } catch (err) {
      spinInFlight.current = false;
      if (!mounted.current) return;
      setSpinError(err instanceof Error ? err.message : 'Không thể quay');
      setIsSpinning(false);
      return;
    }

    const extraRounds = 5 + Math.floor(Math.random() * 3);
    const sliceAngle = 360 / snapshot.length;
    const targetSliceCenter = targetIndex * sliceAngle + sliceAngle / 2;
    const stopAngle = 360 * extraRounds + (360 - targetSliceCenter + 270) % 360;

    const newTotalRotation = rotation - (rotation % 360) + stopAngle;
    setRotation(newTotalRotation);

    const finish = () => {
      if (!spinInFlight.current) return;
      spinInFlight.current = false;
      finishSpin.current = null;
      if (spinTimer.current) clearTimeout(spinTimer.current);
      setIsSpinning(false);
      setWinner(targetWinner);

      if (isMotionEnabled()) confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'],
      });
    };
    finishSpin.current = finish;
    // A fallback also completes the spin when the browser suppresses transition events.
    spinTimer.current = setTimeout(finish, isMotionEnabled() ? SPIN_DURATION_MS + 150 : 0);
  };

  const handleMakeDecision = async () => {
    if (!winner || !isHost || roomStatus !== 'ACTIVE' || decisionPending.current || alreadySaved || spinId == null) return;
    if (!decisionContext.trim()) { setSpinError('Hãy nhập việc cần quyết định trước khi lưu kết quả.'); return; }
    decisionPending.current = true;
    setSavingDecision(true);
    setSpinError('');
    try {
      if (await onConfirmWinnerAsDecision(winner, decisionContext.trim(), spinId) === false) return;
      setSavedLocally(previous => [...previous, spinId]);
      onClose();
    } catch (err) { setSpinError(err instanceof Error ? err.message : 'Không thể lưu đề xuất'); }
    finally { decisionPending.current = false; setSavingDecision(false); }
  };

  return (
    <ModalPortal onClose={onClose} dismissible={!isSpinning && !isSubmittingWheel && !savingDecision}>
      <div className="motion-overlay fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70">
      <div role="dialog" aria-modal="true" aria-labelledby="wheel-heading" className="motion-dialog relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 overflow-hidden text-center max-h-[calc(100dvh-2rem)] flex flex-col">
        <button
          onClick={onClose}
          disabled={isSpinning || isSubmittingWheel || savingDecision}
          aria-label="Close"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-1 px-7 shrink-0">
          <Disc className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 id="wheel-heading" className="text-lg font-bold text-slate-900 dark:text-white">
            {mode === 'SETUP' ? 'Cấu Hình Vòng Quay' : 'Vòng Quay Quyết Định Ngẫu Nhiên'}
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 shrink-0">
          {mode === 'SETUP'
            ? 'Nhập danh sách các lựa chọn hoặc chọn nhanh từ danh sách thành viên trong phòng'
            : 'Đồng bộ thời gian thực kết quả cho toàn bộ thành viên'}
        </p>

        {wheelList.length > 0 && mode === 'SPIN' && (
          <label className="text-left text-xs font-semibold mb-3 shrink-0">
            Chọn vòng quay
            <select aria-label="Chọn vòng quay" value={currentWheelId} disabled={isSpinning || savingDecision}
              onChange={event => { onSelectWheel?.(Number(event.target.value)); setSpinItems(null); setWinner(null); setLocalSpinId(null); setRotation(0); setSpinError(''); setDecisionContext(''); }}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
              {wheelList.map(w => <option key={w.id} value={w.id}>{w.title} · {w.spins.length} lượt quay{w.entries.length === 0 ? ' · Hết lựa chọn' : ''}</option>)}
            </select>
          </label>
        )}

        {spinError && <p role="alert" className="text-xs text-rose-600 mb-3">{spinError}</p>}
        {mode === 'SETUP' ? (
          <form key="setup" onSubmit={handleSaveWheel} data-native-scroll className="tool-view min-h-0 flex-1 overflow-y-auto p-1 text-left space-y-4">
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus-visible:outline-indigo-500 focus-visible:-outline-offset-2"
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

              <div className="space-y-2 p-1">
                {setupEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={entry}
                      onChange={(e) => handleEntryChange(idx, e.target.value)}
                      placeholder={`Lựa chọn ${idx + 1}`}
                      className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus-visible:outline-indigo-500 focus-visible:-outline-offset-2"
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

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={excludeWinner} disabled={isSubmittingWheel}
                onChange={event => setExcludeWinner(event.target.checked)} />
              Loại người thắng khỏi các lượt quay sau
            </label>
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
          <div key={currentWheelId ?? 'spin'} data-native-scroll className="tool-view min-h-0 flex-1 overflow-y-auto p-1 [scrollbar-gutter:stable]">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                {displayItems.length} lựa chọn
              </span>
              {isHost && (
                <button
                  onClick={() => setMode('SETUP')}
                  disabled={isSpinning || savingDecision || roomStatus !== 'ACTIVE'}
                  title="Tạo một vòng quay mới; giữ nguyên vòng quay và lịch sử hiện tại"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 cursor-pointer active:scale-95"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Tạo vòng quay mới</span>
                </button>
              )}
            </div>

            {isHost && <label className="block text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
              Việc cần quyết định
              <input value={decisionContext} disabled={isSpinning || savingDecision || roomStatus !== 'ACTIVE'} maxLength={255}
                onChange={event => { setDecisionContext(event.target.value); setSpinError(''); }} placeholder="Ví dụ: Người bao kèo lẩu"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm" />
            </label>}
            <div className="relative w-[min(100%,34dvh)] max-w-80 aspect-square mx-auto my-4 flex items-center justify-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-rose-500 filter drop-shadow-md" />

              <div
                aria-label="Vòng quay"
                onTransitionEnd={event => {
                  if (event.target === event.currentTarget && event.propertyName === 'transform') finishSpin.current?.();
                }}
                className="w-full h-full rounded-full border-4 border-white dark:border-slate-800 overflow-hidden relative"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  willChange: isSpinning ? 'transform' : 'auto',
                  transition: isSpinning && isMotionEnabled()
                    ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.65, 0.14, 1)`
                    : 'none',
                }}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {displayItems.map((item, idx) => {
                    const startAngle = (idx * 360) / numItems;
                    const endAngle = ((idx + 1) * 360) / numItems;

                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;

                    const x1 = 50 + 50 * Math.cos(startRad);
                    const y1 = 50 + 50 * Math.sin(startRad);
                    const x2 = 50 + 50 * Math.cos(endRad);
                    const y2 = 50 + 50 * Math.sin(endRad);

                    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                    const pathData = numItems === 1
                      ? 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z'
                      : `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;

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

            <div aria-live="polite" className="mt-4 min-h-[144px] flex flex-col items-center justify-center">
              {winner ? (
                <div key={`${currentWheelId ?? 'wheel'}-${winner}`} className="tool-result w-full p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>KẾT QUẢ VÒNG QUAY</span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                    🎉 {winner} 🎉
                  </p>
                  {decisionContext.trim() && <p className="mt-2 text-sm break-words">{decisionContext.trim()} → <strong>{winner}</strong></p>}
                  {isHost && <button
                    onClick={handleMakeDecision}
                    disabled={alreadySaved || savingDecision || roomStatus !== 'ACTIVE' || spinId == null}
                    className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2 mx-auto cursor-pointer transition-transform hover:scale-105"
                  >
                    <span>{alreadySaved ? 'Đã tạo đề xuất từ lượt quay này' : savingDecision ? 'Đang lưu đề xuất...' : 'Tạo đề xuất từ kết quả'}</span>
                  </button>}
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  {isSpinning
                    ? 'Đang quay ngẫu nhiên... Xin chờ trong giây lát!'
                    : items.length > 0 ? `Sẵn sàng quay ${items.length} mục` : 'Chưa có lựa chọn để quay. Host có thể tạo vòng quay mới.'}
                </div>
              )}
            </div>


            {selectedWheel && selectedWheel.spins.length > 0 && !isSpinning && (
              <details className="mt-4 text-left text-xs">
                <summary className="cursor-pointer font-semibold">Lịch sử · {selectedWheel.spins.length} lượt quay</summary>
                <ol className="tool-view mt-2 space-y-2">{selectedWheel.spins.map(spin => (
                  <li key={spin.id} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                    <strong>{spin.resultEntry}</strong> · {spin.actorNickname} · {new Date(spin.createdAt).toLocaleString('vi-VN')}
                  </li>
                ))}</ol>
              </details>
            )}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Kết quả được tạo ngẫu nhiên minh bạch cho toàn phòng</span>
            </div>
          </div>
        )}
        {mode === 'SPIN' && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-center gap-3">
              <button
                onClick={handleSpin}
                disabled={isSpinning || savingDecision || items.length === 0 || !isHost || roomStatus !== 'ACTIVE'}
                className="tool-interactive w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'Đang quay ngẫu nhiên...' : 'QUAY NGAY'}</span>
              </button>
            </div>

        )}
      </div>
    </div>
    </ModalPortal>
  );
};
