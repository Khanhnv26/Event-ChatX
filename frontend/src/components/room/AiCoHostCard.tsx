import { useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, CircleHelp, ListChecks, Sparkles } from 'lucide-react';
import type { AiSummarySource } from '../../types/backend.types';
import type { ChatMessage } from '../../types/room';

const sections = [
  { key: 'decided', label: 'Đã chốt', icon: CheckCircle2, tone: 'bg-accent-soft text-accent-text' },
  { key: 'open', label: 'Còn mở', icon: CircleHelp, tone: 'bg-warn-soft text-warn-text' },
  { key: 'next', label: 'Việc tiếp theo', icon: ListChecks, tone: 'bg-primary/10 text-primary-text' },
] as const;

export function AiCoHostCard({ message, replyContent }: { message: ChatMessage; replyContent?: string }) {
  const card = useRef<HTMLElement>(null);
  const [excerpt, setExcerpt] = useState<AiSummarySource | null>(null);
  const summary = message.aiSummary;
  const demo = summary?.demo || message.aiDemo;
  const populatedSections = summary ? sections.filter(({ key }) => summary[key].length > 0) : [];

  const jumpToSource = (source: AiSummarySource) => {
    const scope = card.current?.closest('[data-ai-scope]');
    const target = Array.from(scope?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [])
      .find(element => element.dataset.messageId === source.id);
    if (!target) {
      setExcerpt(source);
      return;
    }
    setExcerpt(null);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  };

  return (
    <article ref={card} data-message-id={message.id} tabIndex={-1}
      className="chat-message w-full max-w-xl overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-xs focus:outline-2 focus:outline-primary">
      <header className="flex items-center gap-2.5 border-b border-border bg-card-muted/50 px-3 py-2.5 sm:px-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary-text">
          <Sparkles aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-primary-text">AI Co-Host</p>
          <h3 className="text-sm font-bold text-foreground">{message.aiImageCount ? 'Phân tích ảnh' : summary ? 'Tóm tắt thảo luận' : 'Trả lời thảo luận'}</h3>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{message.createdAt}</span>
      </header>
      <div className="space-y-2.5 px-3 py-3 sm:px-4">
        {Boolean(message.aiImageCount) && <p className="text-xs text-muted-foreground">Đã phân tích {message.aiImageCount} ảnh</p>}
        {!summary && replyContent && (
          <p className="line-clamp-2 border-l-2 border-primary/30 pl-2 text-xs text-muted-foreground">
            Trả lời · {replyContent}
          </p>
        )}
        {demo && (
          <p className="rounded-lg bg-primary/10 px-2.5 py-2 text-xs font-medium text-primary-text">
            Chế độ thử nghiệm · Cần cấu hình Gemini để phân tích nội dung.
          </p>
        )}
        {summary ? (
          <>
            <p className="text-xs text-muted-foreground">
              {summary.contextCount === 0 ? 'Chưa có tin nhắn văn bản để tóm tắt.'
                : `${summary.contextCount} tin nhắn gần đây · ${message.threadRootId ? 'Nhánh thảo luận' : 'Kênh chính'}`}
            </p>
            {summary.contextCount > 0 && populatedSections.length === 0 && (
              <p className="rounded-lg bg-card-muted px-3 py-2 text-xs text-muted-foreground">
                Chưa ghi nhận quyết định, câu hỏi mở hoặc việc tiếp theo.
              </p>
            )}
            {populatedSections.map(({ key, label, icon: Icon, tone }) => (
              <section key={key} className="flex items-start gap-2.5 rounded-xl border border-border px-2.5 py-2">
                <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${tone}`}>
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-foreground">{label}</h4>
                  <ul className="mt-1.5 space-y-2">
                    {summary[key].map((item, index) => (
                      <li key={index} className="text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                        {item.text}
                        <span className="mt-1 flex flex-wrap gap-1">
                          {item.sources.map(source => (
                            <button type="button" key={source.id} onClick={() => jumpToSource(source)}
                              title={source.speaker}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 text-xs font-semibold text-primary-text hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
                              Nguồn {source.number} <ArrowUpRight aria-hidden="true" className="size-3" />
                            </button>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
            {excerpt && (
              <div role="status" className="rounded-xl border border-border bg-card-muted p-3 text-xs">
                <p className="font-bold">Nguồn {excerpt.number} · {excerpt.speaker}</p>
                <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{excerpt.excerpt}</p>
                <p className="mt-1 text-muted-foreground">Tin nhắn gốc nằm ngoài phần chat đang hiển thị.</p>
              </div>
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{message.content}</p>
        )}
      </div>
    </article>
  );
}
