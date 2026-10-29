import { useEffect, useState } from 'react';
import { eventChatApi } from '../../services/eventChatApi';
import type { RoomExportResponse } from '../../types/backend.types';
import { toast } from '../../stores/toastStore';
import { ModalPortal } from '../common/ModalPortal';
import {
  FileText,
  X,
  Copy,
  Download,
  Share2,
  Printer,
  CheckCircle2,
  Vote,
  Disc,
  Sparkles,
  Users,
  Calendar,
  Eye,
  FileCode,
  RotateCcw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  roomCode: string;
  onClose: () => void;
}

export function ExportSummaryModal({ isOpen, roomCode, onClose }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [activeTab, setActiveTab] = useState<'preview' | 'markdown'>('preview');
  const requestKey = `${roomCode}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    report: RoomExportResponse | null;
    error: string | null;
  } | null>(null);

  const report = result?.key === requestKey ? result.report : null;
  const error = result?.key === requestKey ? result.error : null;
  const loading = result?.key !== requestKey;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void eventChatApi
      .exportSummary(roomCode)
      .then((data) => {
        if (active) setResult({ key: requestKey, report: data, error: null });
      })
      .catch((err) => {
        if (active)
          setResult({
            key: requestKey,
            report: null,
            error: err instanceof Error ? err.message : 'Không thể xuất biên bản',
          });
      });
    return () => {
      active = false;
    };
  }, [isOpen, roomCode, requestKey]);

  if (!isOpen) return null;

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdownSummary);
      toast.success('Đã sao chép biên bản vào bộ nhớ tạm.');
    } catch {
      toast.error('Không thể sao chép. Bạn có thể tải file Markdown.');
    }
  };

  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([report.markdownSummary], { type: 'text/markdown;charset=utf-8' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `EventChat_${roomCode}_BienBan.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const share = async () => {
    if (!report) return;
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: `Biên bản: ${report.roomTitle}`,
        text: report.markdownSummary,
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        toast.error('Không thể chia sẻ biên bản.');
      }
    }
  };

  const printDocument = () => {
    window.print();
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="motion-overlay fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 flex items-center justify-center">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-title"
          className="motion-dialog max-w-4xl w-full max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden relative"
        >
          {/* Header */}
          <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 id="export-title" className="font-bold text-base sm:text-lg tracking-tight">
                  Biên bản cuộc họp & thảo luận
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {report ? report.roomTitle : `Phòng #${roomCode}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                data-modal-autofocus
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          {report && (
            <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'preview'}
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Bản xem trước trực quan</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'markdown'}
                onClick={() => setActiveTab('markdown')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'markdown'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Mã nguồn Markdown</span>
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {loading && (
              <div role="status" className="py-16 text-center space-y-3">
                <div className="w-8 h-8 mx-auto border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Đang trích xuất biên bản từ máy chủ...</p>
              </div>
            )}

            {error && (
              <div role="alert" className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-center space-y-3">
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Thử lại</span>
                </button>
              </div>
            )}

            {report && (
              <>
                {/* Visual Preview Tab */}
                <div
                  id="printable-summary"
                  role="tabpanel"
                  className={activeTab === 'preview' ? 'space-y-6 block' : 'hidden'}
                >
                  {/* Meeting Metadata Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/50 dark:from-indigo-950/40 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {report.roomTitle}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          #{report.roomSlug}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                            report.roomStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {report.roomStatus === 'ACTIVE' ? 'Đang mở' : 'Đã kết thúc'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Xuất lúc: {new Date(report.exportedAt).toLocaleString('vi-VN')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{report.participantCount} thành viên tham gia</span>
                      </div>
                    </div>
                  </div>

                  {/* 1. Confirmed Decisions */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        1. Các quyết định đã chốt ({report.confirmedDecisions.length})
                      </h4>
                    </div>

                    {report.confirmedDecisions.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                        Chưa có quyết định nào được chốt trong phòng.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {report.confirmedDecisions.map((decision, idx) => (
                          <div
                            key={decision.id || idx}
                            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                                  #{idx + 1}
                                </span>
                                <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {decision.text}
                                </p>
                              </div>
                              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                Đã chốt
                              </span>
                            </div>
                            {decision.creatorNickname && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Đề xuất bởi: <span className="font-medium text-slate-700 dark:text-slate-300">{decision.creatorNickname}</span>
                                {decision.confirmedAt && ` · Chốt lúc ${new Date(decision.confirmedAt).toLocaleTimeString('vi-VN')}`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Poll Results */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <Vote className="w-4 h-4 text-indigo-500" />
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        2. Kết quả bình chọn ({report.polls.length})
                      </h4>
                    </div>

                    {report.polls.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                        Không có cuộc bình chọn nào trong phòng.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {report.polls.map((poll) => {
                          const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.voteCount || 0), 0);
                          const maxVotes = Math.max(...poll.options.map((opt) => opt.voteCount || 0), 0);

                          return (
                            <div
                              key={poll.id}
                              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {poll.question}
                                </h5>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {totalVotes} phiếu
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {poll.options.map((opt) => {
                                  const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                                  const isLeader = maxVotes > 0 && opt.voteCount === maxVotes;

                                  return (
                                    <div key={opt.id} className="space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className={`font-medium ${isLeader ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                          {opt.label}
                                        </span>
                                        <span className="font-mono text-slate-500 text-[11px]">
                                          {opt.voteCount} phiếu ({pct}%)
                                        </span>
                                      </div>
                                      <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            isLeader
                                              ? 'bg-indigo-600 dark:bg-indigo-500'
                                              : 'bg-slate-400 dark:bg-slate-500'
                                          }`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. Wheel Results */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <Disc className="w-4 h-4 text-purple-500" />
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        3. Kết quả vòng quay may mắn ({report.wheels.length})
                      </h4>
                    </div>

                    {report.wheels.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                        Không có vòng quay may mắn nào.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {report.wheels.map((wheel) => (
                          <div
                            key={wheel.id}
                            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                          >
                            <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                              {wheel.title}
                            </h5>

                            {wheel.spins && wheel.spins.length > 0 ? (
                              <div className="space-y-1.5">
                                {wheel.spins.map((spin, sIdx) => (
                                  <div
                                    key={spin.id || sIdx}
                                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/50"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                      <span className="font-bold text-purple-700 dark:text-purple-300">
                                        {spin.resultEntry}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                      Quay bởi {spin.actorNickname}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic">Vòng quay chưa có lượt quay nào.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw Markdown Tab (Rendered in DOM for testing & easy copy) */}
                <div
                  role="tabpanel"
                  className={activeTab === 'markdown' ? 'space-y-3 block' : 'hidden'}
                >
                  <pre className="whitespace-pre-wrap break-words text-xs sm:text-sm font-mono bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 leading-relaxed text-slate-800 dark:text-slate-200 select-all max-h-[50vh] overflow-y-auto">
                    {report.markdownSummary}
                  </pre>
                </div>
              </>
            )}
          </div>

          {/* Action Footer */}
          {report && (
            <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={download}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Markdown</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={printDocument}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In / Lưu PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => void share()}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Chia sẻ</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </ModalPortal>
  );
}
