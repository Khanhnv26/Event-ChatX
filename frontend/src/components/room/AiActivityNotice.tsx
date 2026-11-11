import { Sparkles } from 'lucide-react';
import type { AiActivity, ChatMessage } from '../../types/room';

export function AiSummaryButton({ onSend, disabled, compact = false }: {
  onSend: (text: string) => Promise<boolean>;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={() => void onSend('/ai tóm tắt thảo luận')}
      title="Tóm tắt thảo luận"
      aria-label="Tóm tắt thảo luận"
      className="ws-chip chat-tool-action min-h-8 border-primary/20 bg-primary/10 text-primary-text hover:bg-primary/15">
      <Sparkles aria-hidden="true" className="size-3.5" />
      <span className={compact ? 'chat-tool-label' : undefined}>{compact ? 'Tóm tắt' : 'Tóm tắt thảo luận'}</span>
    </button>
  );
}

export function AiActivityNotice({ activities, messages, disabled, onRetry, onDismiss }: {
  activities: AiActivity[];
  messages: ChatMessage[];
  disabled: boolean;
  onRetry: (text: string, replyToId?: string) => Promise<boolean>;
  onDismiss?: (id: string) => void;
}) {
  const thinking = activities.some(activity => !activity.error);
  const failure = activities.findLast(activity => activity.error);
  const promptMessage = messages.find(message => message.id === failure?.requestId);
  const prompt = promptMessage?.content;
  const imageSourceId = promptMessage?.attachments?.some(item => item.contentType?.startsWith('image/'))
    ? promptMessage.id : promptMessage?.replyToId;
  return (
    <>
      {thinking && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary-text">
          <Sparkles aria-hidden="true" className="size-4 motion-safe:animate-pulse" />
          AI Co-Host đang soạn câu trả lời…
        </p>
      )}
      {failure && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
          <p role="alert" className="flex-1 text-muted-foreground">{failure.error}</p>
          {prompt && <button type="button" disabled={disabled || thinking} className="ws-chip"
            onClick={async () => {
              const retried = imageSourceId ? await onRetry(prompt, imageSourceId) : await onRetry(prompt);
              if (retried) onDismiss?.(failure.requestId);
            }}>Thử lại</button>}
          <button type="button" className="ws-chip" onClick={() => onDismiss?.(failure.requestId)}>Bỏ qua</button>
        </div>
      )}
    </>
  );
}
