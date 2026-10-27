import React, { useState, useRef, useEffect } from 'react';
import { usePointerParallax } from '../../hooks/usePointerParallax';
import { isMotionEnabled } from '../../services/motionPreference';
import { RoomExpiryPicker } from './RoomExpiryPicker';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  CheckCircle2,
  Clock,
  QrCode,
  Vote,
  FileCheck,
  Disc,
  Check,
  Copy,
  Sparkles,
  Flame,
  MessageCircle,
  BarChart2,
  Lock,
} from 'lucide-react';

interface LandingViewProps {
  onEnterRoom: (roomTitle?: string, nickname?: string) => void;
  onCreateRoom?: (title: string, nickname: string, ttlMinutes: number) => void;
  onJoinRoom?: (slug: string, nickname: string) => void;
  pendingAction?: 'create' | 'join' | null;
}

const TiltCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !isMotionEnabled() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    cancelAnimationFrame(frameRef.current);
    const { clientX, clientY } = e;
    frameRef.current = requestAnimationFrame(() => {
      const cardEl = cardRef.current;
      const spotlightEl = spotlightRef.current;
      if (!cardEl) return;

      const rect = cardEl.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = -((y - centerY) / centerY) * 4;
      const rotateY = ((x - centerX) / centerX) * 4;

      cardEl.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.012, 1.012, 1.012)`;
      cardEl.style.transition = 'transform 0.1s ease-out';

      if (spotlightEl) {
        spotlightEl.style.opacity = '1';
        spotlightEl.style.transform = `translate3d(${x - 180}px, ${y - 180}px, 0)`;
      }
    });
  };

  const handlePointerLeave = () => {
    cancelAnimationFrame(frameRef.current);
    const cardEl = cardRef.current;
    const spotlightEl = spotlightRef.current;
    if (!cardEl) return;

    cardEl.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    cardEl.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)';

    if (spotlightEl) {
      spotlightEl.style.opacity = '0';
    }
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute top-0 left-0 size-[360px] z-10 opacity-0 transition-opacity duration-200"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12), transparent 70%)' }}
      />
      {children}
    </div>
  );
};

export const LandingView: React.FC<LandingViewProps> = ({ onEnterRoom, onCreateRoom, onJoinRoom, pendingAction = null }) => {
  const [createTitle, setCreateTitle] = useState('Kèo Ăn Uống & Chốt Lịch Cuối Tuần');
  const [ttlMinutes, setTtlMinutes] = useState<number | null>(1440);
  const [joinCode, setJoinCode] = useState('EVT-9824');
  const [joinNickname, setJoinNickname] = useState('Tuấn Dev');

  const heroRef = useRef<HTMLDivElement>(null);
  usePointerParallax(heroRef);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction || ttlMinutes === null) return;
    if (onCreateRoom) {
      onCreateRoom(createTitle, 'Host', ttlMinutes);
    } else {
      onEnterRoom(createTitle, 'Minh (Host)');
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction) return;
    if (onJoinRoom) {
      onJoinRoom(joinCode, joinNickname || 'Khách');
    } else {
      onEnterRoom('Kèo Ăn Uống & Chốt Lịch Cuối Tuần', joinNickname || 'Khách');
    }
  };

  return (
    <div className="landing-page page-enter space-y-16 py-6 sm:py-10 relative">
      <div ref={heroRef} className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 min-h-[560px]">
        <div
          className="hidden xl:flex absolute top-6 left-4 xl:left-8 2xl:left-14 pointer-events-none select-none z-10 transition-transform duration-75"
          data-parallax-x="0.9" data-parallax-y="0.9"
        >
          <div className="animate-float-gentle flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-indigo-200/70 dark:border-indigo-800/70 shadow-lg shadow-indigo-500/10 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            <span>Realtime Sync &lt; 1s</span>
          </div>
        </div>

        <div
          className="hidden xl:flex absolute top-1 right-4 xl:right-10 2xl:right-16 pointer-events-none select-none z-10 transition-transform duration-75"
          data-parallax-x="-0.85" data-parallax-y="0.75"
        >
          <div className="animate-float-delayed flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-purple-200/70 dark:border-purple-800/70 shadow-lg shadow-purple-500/10 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            <span>Zero-login • Không tài khoản</span>
          </div>
        </div>

        <div
          className="hidden xl:flex absolute top-[52%] left-2 xl:left-6 2xl:left-12 pointer-events-none select-none z-10 transition-transform duration-75"
          data-parallax-x="1.1" data-parallax-y="-0.85"
        >
          <div className="animate-float-slow flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-emerald-200/70 dark:border-emerald-800/70 shadow-lg shadow-emerald-500/10 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Không trôi kết luận</span>
          </div>
        </div>

        <div
          className="hidden xl:flex absolute top-[68%] right-2 xl:right-8 2xl:right-14 pointer-events-none select-none z-10 transition-transform duration-75"
          data-parallax-x="-1" data-parallax-y="-1"
        >
          <div className="animate-float-reverse flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-amber-200/70 dark:border-amber-800/70 shadow-lg shadow-amber-500/10 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <FileCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>1-Click Copy Zalo</span>
          </div>
        </div>

        <div
          className="hidden xl:flex absolute top-[44%] right-4 xl:right-12 2xl:right-20 pointer-events-none select-none z-10 transition-transform duration-75"
          data-parallax-x="-0.9" data-parallax-y="1.1"
        >
          <div className="animate-float-gentle flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-sky-200/70 dark:border-sky-800/70 shadow-lg shadow-sky-500/10 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <BarChart2 className="w-3.5 h-3.5 text-sky-500" />
            <span>Biểu quyết ẩn danh</span>
          </div>
        </div>

        <div
          className="hidden xl:flex absolute top-[72%] left-4 xl:left-10 2xl:left-18 pointer-events-none select-none z-10 transition-transform duration-75"
          data-parallax-x="0.8" data-parallax-y="0.9"
        >
          <div className="animate-float-delayed flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-rose-200/70 dark:border-rose-800/70 shadow-lg shadow-rose-500/10 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Disc className="w-3.5 h-3.5 text-rose-500 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Vòng quay may mắn</span>
          </div>
        </div>

        <div
          className="absolute top-10 left-[22%] pointer-events-none select-none z-0 transition-transform duration-100 hidden sm:flex"
          data-parallax-x="0.6" data-parallax-y="0.6"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-400/20 to-orange-400/20 dark:from-amber-400/30 dark:to-orange-400/30 backdrop-blur-sm border border-amber-300/40 dark:border-amber-500/40 shadow-sm flex items-center justify-center animate-float-slow text-amber-500">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        <div
          className="absolute top-12 right-[20%] pointer-events-none select-none z-0 transition-transform duration-100 hidden sm:flex"
          data-parallax-x="-0.7" data-parallax-y="0.5"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-pink-500/20 dark:from-rose-500/30 dark:to-pink-500/30 backdrop-blur-sm border border-rose-300/40 dark:border-rose-500/40 shadow-sm flex items-center justify-center animate-float-delayed text-rose-500">
            <Flame className="w-4 h-4" />
          </div>
        </div>

        <div
          className="absolute top-[32%] left-[3%] pointer-events-none select-none z-0 transition-transform duration-100 hidden lg:flex"
          data-parallax-x="1.3" data-parallax-y="-1.1"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 dark:from-indigo-500/30 dark:to-violet-500/30 backdrop-blur-sm border border-indigo-300/40 dark:border-indigo-500/40 shadow-sm flex items-center justify-center animate-float-reverse text-indigo-500">
            <MessageCircle className="w-4 h-4" />
          </div>
        </div>

        <div
          className="absolute top-[88%] right-[6%] pointer-events-none select-none z-0 transition-transform duration-100 hidden lg:flex"
          data-parallax-x="-1.2" data-parallax-y="-0.9"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/30 dark:to-teal-500/30 backdrop-blur-sm border border-emerald-300/40 dark:border-emerald-500/40 shadow-sm flex items-center justify-center animate-float-slow text-emerald-500">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div
          className="absolute top-[86%] left-[8%] pointer-events-none select-none z-0 transition-transform duration-100 hidden lg:flex"
          data-parallax-x="1" data-parallax-y="1.2"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-blue-500/20 dark:from-sky-500/30 dark:to-blue-500/30 backdrop-blur-sm border border-sky-300/40 dark:border-sky-500/40 shadow-sm flex items-center justify-center animate-float-gentle text-sky-500">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="text-center max-w-3xl mx-auto pt-2">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.18]">
            <span className="block">Bàn nhanh. Chốt rõ.</span>
            <span className="inline-block mt-1 sm:mt-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-sky-500 via-purple-500 to-emerald-400 animate-gradient-flow whitespace-nowrap">
              Chia sẻ ngay.
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            <span className="block">
              Phòng chốt việc tạm thời cho nhóm bạn, đồ án sinh viên và hội nhóm.
            </span>
            <span className="block mt-1 sm:mt-1.5 text-slate-500 dark:text-slate-400">
              Không cần tạo tài khoản, không kết bạn, tự động dọn rác sau khi kết thúc.
            </span>
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto items-stretch">
          <TiltCard className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/60 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600/70 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Mở phiên thảo luận mới
                </h2>
              </div>

              <form id="form-create-room" onSubmit={handleCreate} className="space-y-3.5">
                <div>
                  <label htmlFor="create-room-title" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Chủ đề thảo luận
                  </label>
                  <input
                    id="create-room-title"
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="Ví dụ: Lên menu tiệc sinh nhật..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>

                <RoomExpiryPicker onChange={setTtlMinutes} />
              </form>
            </div>

            <div className="pt-5 mt-auto">
              <button
                type="submit"
                form="form-create-room"
                disabled={Boolean(pendingAction) || ttlMinutes === null}
                aria-busy={pendingAction === 'create'}
                className="group relative overflow-hidden w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer-sweep" />
                <span className="relative z-10">{pendingAction === 'create' ? 'Đang tạo phòng...' : 'Tạo phòng ngay'}</span>
                <ArrowRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </TiltCard>

          <TiltCard className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/60 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600/70 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Vào phòng bằng mã
                </h2>
              </div>

              <form id="form-join-room" onSubmit={handleJoin} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="join-room-code" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Mã phòng
                    </label>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-medium">
                      EVT-9824
                    </span>
                  </div>
                  <input
                    id="join-room-code"
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="EVT-9824"
                    required
                    className="w-full font-mono uppercase tracking-wider px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="join-nickname" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Biệt danh
                  </label>
                  <input
                    id="join-nickname"
                    type="text"
                    value={joinNickname}
                    onChange={(e) => setJoinNickname(e.target.value)}
                    placeholder="Ví dụ: Tuấn Dev, Lan Anh..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </form>
            </div>

            <div className="pt-5 mt-auto">
              <button
                type="submit"
                form="form-join-room"
                disabled={Boolean(pendingAction)}
                aria-busy={pendingAction === 'join'}
                className="group relative overflow-hidden w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.98] border border-slate-700/60 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer-sweep" />
                <span className="relative z-10">{pendingAction === 'join' ? 'Đang tham gia...' : 'Tham gia phòng'}</span>
                <ArrowRight className="w-4 h-4 text-emerald-400 relative z-10 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </TiltCard>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-2.5 px-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/70 dark:border-slate-800/70 text-xs font-medium text-slate-600 dark:text-slate-400 max-w-2xl mx-auto shadow-sm">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Không tài khoản</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Tự dọn dẹp sau phiên</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Xuất Zalo / Messenger</span>
          </div>
        </div>
      </div>

      <section className="landing-steps max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-12 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-72 bg-gradient-to-r from-indigo-500/5 via-amber-500/5 to-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Quy trình 3 bước: Bàn nhanh, Chốt rõ
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto text-balance leading-relaxed">
            3 bước đơn giản giúp nhóm chốt việc dứt điểm, không trôi tin nhắn
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative items-stretch">
          <div className="group relative flex">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-indigo-500/10 to-indigo-600/5 dark:from-indigo-500/20 dark:to-indigo-600/10 blur-xl opacity-60 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-500 pointer-events-none" />

            <TiltCard className="p-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 hover:border-indigo-400/80 dark:hover:border-indigo-500/80 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between h-full w-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 group-hover:border-indigo-300 dark:group-hover:border-indigo-700 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Bước 01 • Khởi tạo
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-semibold">
                    01 / 03
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Tạo phòng & Quét mã
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Mở phòng trong 2 giây, gửi link vào nhóm chat là vào ngay.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 group-hover:border-indigo-200 dark:group-hover:border-indigo-900/60 space-y-3 text-xs shadow-xs transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50" />
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      #EVT-9824
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-full border border-slate-200/80 dark:border-slate-700/80 shadow-xs group-hover:border-indigo-200 dark:group-hover:border-indigo-800 transition-colors">
                    <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Mã QR sẵn sàng</span>
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs group-hover:border-indigo-200/80 dark:group-hover:border-indigo-800/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    <span className="truncate font-mono text-xs text-slate-700 dark:text-slate-300">
                      eventchat.app/join/9824
                    </span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 group-hover:bg-indigo-600 group-hover:text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-indigo-200/60 dark:border-indigo-800/60 transition-all duration-200 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Sao chép</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>6 người đã vào</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                    Ẩn danh 100%
                  </span>
                </div>
              </div>
            </TiltCard>
          </div>

          <div className="group relative flex">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10 blur-xl opacity-60 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-500 pointer-events-none" />

            <TiltCard className="p-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 hover:border-amber-400/80 dark:hover:border-amber-500/80 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between h-full w-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 group-hover:border-amber-300 dark:group-hover:border-amber-700 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Bước 02 • Bỏ phiếu
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-semibold">
                    02 / 03
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Bình chọn & Vòng quay
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Bỏ phiếu tức thì hoặc quay ngẫu nhiên khi bất đồng ý kiến.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 group-hover:border-amber-200 dark:group-hover:border-amber-900/60 space-y-3 text-xs shadow-xs transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                    <Vote className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ăn gì hôm nay?</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-200/70 dark:border-amber-800/70">
                    Đang bình chọn
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800 dark:text-slate-200">Lẩu Haidilao Landmark</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">67% (4/6)</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full relative"
                      style={{ width: '67%' }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>BBQ Hàn Quốc</span>
                    <span className="font-mono">33% (2/6)</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-slate-400 dark:bg-slate-500 h-full rounded-full" style={{ width: '33%' }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Disc className="w-3.5 h-3.5 text-amber-500 animate-spin group-hover:[animation-duration:1.5s] transition-all" style={{ animationDuration: '8s' }} />
                    <span>Vòng quay may mắn</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:animate-ping" />
                    Realtime
                  </span>
                </div>
              </div>
            </TiltCard>
          </div>

          <div className="group relative flex">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10 blur-xl opacity-60 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-500 pointer-events-none" />

            <TiltCard className="p-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 hover:border-emerald-400/80 dark:hover:border-emerald-500/80 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 flex flex-col justify-between h-full w-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80 group-hover:border-emerald-300 dark:group-hover:border-emerald-700 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Bước 03 • Chốt việc
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-semibold">
                    03 / 03
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Ghim & Xuất biên bản
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Ghim kết luận rõ ràng, sao chép 1 chạm gửi thẳng Zalo.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 group-hover:border-emerald-200 dark:group-hover:border-emerald-900/60 space-y-3 text-xs shadow-xs transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 animate-pulse-subtle flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 group-hover:scale-105 transition-transform">
                    <Check className="w-3 h-3" />
                    <span>CONFIRMED</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-medium">17:15</span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs group-hover:border-emerald-300 dark:group-hover:border-emerald-700 group-hover:shadow-xs transition-all">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Lẩu Haidilao Landmark 81
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span>Đã thông qua bởi đa số biểu quyết</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Biên bản hoàn tất
                  </span>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 group-hover:bg-indigo-600 group-hover:text-white px-2.5 py-1 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1 transition-all duration-200 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Zalo</span>
                  </button>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>
    </div>
  );
};
