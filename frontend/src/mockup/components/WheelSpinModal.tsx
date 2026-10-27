import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { X, Disc, Sparkles, CheckCircle2, RotateCw, ShieldCheck } from 'lucide-react';
import type { WheelItem } from '../types';

interface WheelSpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WheelItem[];
  onConfirmWinnerAsDecision: (winnerLabel: string) => void;
}

export const WheelSpinModal: React.FC<WheelSpinModalProps> = ({
  isOpen,
  onClose,
  items,
  onConfirmWinnerAsDecision,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);

  if (!isOpen) return null;

  const numItems = items.length;
  const sliceAngle = 360 / numItems;

  const handleSpin = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setWinner(null);

    // Pick a random target index
    const randomIndex = Math.floor(Math.random() * numItems);
    // Extra rotations: 5 to 7 full circles (1800 - 2520 deg)
    const extraRounds = 5 + Math.floor(Math.random() * 3);

    // Calculate angle so pointer (at 90deg top or 0deg right) lands on the target
    // If pointer is at Top (270deg or -90deg):
    // Angle of slice i is (i * sliceAngle + sliceAngle / 2)
    const targetSliceCenter = randomIndex * sliceAngle + sliceAngle / 2;
    // We want (rotation + newDelta) % 360 to align with top pointer (270 deg)
    const stopAngle = 360 * extraRounds + (360 - targetSliceCenter + 270) % 360;

    const newTotalRotation = rotation + stopAngle;
    setRotation(newTotalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const chosenItem = items[randomIndex];
      setWinner(chosenItem.label);

      // Trigger celebratory confetti
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'],
      });
    }, 4000);
  };

  const handleMakeDecision = () => {
    if (winner) {
      onConfirmWinnerAsDecision(winner);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 overflow-hidden text-center">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isSpinning}
          aria-label="Close"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <Disc className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Vòng Quay Quyết Định Ngẫu Nhiên
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Server CSPRNG kết quả đồng bộ thời gian thực cho mọi thành viên trong phòng
        </p>

        {/* Wheel Graphic Container */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 mx-auto my-2 flex items-center justify-center">
          {/* Top Indicator Arrow */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-rose-500 filter drop-shadow-md" />

          {/* Wheel Disc */}
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

                // Text position angle
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

            {/* Wheel Center Cap */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white dark:bg-slate-900 border-4 border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>

        {/* Winner Announcement or Idle State */}
        <div className="mt-6 min-h-[90px] flex flex-col items-center justify-center">
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
                ? 'Đang quay... Cả phòng đang theo dõi trực tiếp!'
                : `Có ${items.length} lựa chọn trong vòng quay này`}
            </div>
          )}
        </div>

        {/* Spin Actions */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={handleSpin}
            disabled={isSpinning}
            className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            <span>{isSpinning ? 'Đang quay ngẫu nhiên...' : 'QUAY NGAY (HOST ONLY)'}</span>
          </button>
        </div>

        {/* Host authorization notice */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
          <span>Chỉ Host có quyền kích hoạt lệnh quay; kết quả được broadcast toàn phòng</span>
        </div>
      </div>
    </div>
  );
};
