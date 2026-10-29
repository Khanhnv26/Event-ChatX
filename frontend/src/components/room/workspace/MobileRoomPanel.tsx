import { useId, type ReactNode } from 'react';
import { CheckCircle2, Users, X } from 'lucide-react';
import { ModalPortal } from '../../common/ModalPortal';

export type MobileRoomTab = 'decisions' | 'participants';
interface Props {
  tab: MobileRoomTab;
  onTabChange: (tab: MobileRoomTab) => void;
  onClose: () => void;
  roomTitle: string;
  confirmedCount: number;
  participantCount: number;
  roomInfo: ReactNode;
  decisions: ReactNode;
  participants: ReactNode;
}

export function MobileRoomPanel({ tab, onTabChange, onClose, roomTitle, confirmedCount, participantCount, roomInfo, decisions, participants }: Props) {
  const id = useId();
  return <ModalPortal onClose={onClose}>
    <div className="motion-overlay fixed inset-0 z-[100] bg-slate-950/70 flex items-end justify-center lg:hidden">
      <section role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
        className="motion-sheet mobile-room-sheet w-full max-w-xl h-[85dvh] max-h-[calc(100dvh-1rem)] flex flex-col rounded-t-3xl border border-border bg-card text-foreground shadow-2xl overflow-hidden">
        <div aria-hidden="true" className="w-10 h-1 rounded-full bg-border mx-auto mt-2.5 shrink-0" />
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
          <div className="min-w-0"><h2 id={`${id}-title`} className="text-base font-bold">Không gian phòng</h2><p className="text-xs text-muted-foreground truncate">{roomTitle}</p></div>
          <button type="button" aria-label="Đóng bảng phòng" onClick={onClose} className="ws-icon-btn p-2"><X className="w-5 h-5" /></button>
        </header>
        <div role="tablist" aria-label="Nội dung phòng" className="grid grid-cols-2 gap-1 rounded-2xl bg-card-muted mx-4 mb-3 p-1 shrink-0"
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'decisions' : event.key === 'End' ? 'participants' : tab === 'decisions' ? 'participants' : 'decisions';
            onTabChange(next);
            event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
          }}>
          {(['decisions', 'participants'] as const).map(value => <button key={value} id={`${id}-${value}-tab`} data-tab={value}
            type="button" role="tab" aria-selected={tab === value} aria-controls={`${id}-${value}`} tabIndex={tab === value ? 0 : -1}
            onClick={() => onTabChange(value)} className="tool-interactive flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold text-muted-foreground aria-selected:bg-card aria-selected:text-primary aria-selected:shadow-sm">
            {value === 'decisions' ? <CheckCircle2 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            {value === 'decisions' ? `Quyết định (${confirmedCount})` : `Thành viên (${participantCount})`}
          </button>)}
        </div>
        <div data-native-scroll className="mobile-room-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-gutter:stable]">
          <div hidden={tab !== 'decisions'} role="tabpanel" id={`${id}-decisions`} aria-labelledby={`${id}-decisions-tab`}>
            <details className="rounded-2xl border border-border bg-card-muted/40 p-3 mb-4">
              <summary className="cursor-pointer text-xs font-semibold">Thông tin phòng</summary>
              <div className="tool-view mt-3">{roomInfo}</div>
            </details>
            <div className={tab === 'decisions' ? 'tool-view' : ''}>{decisions}</div>
          </div>
          <div hidden={tab !== 'participants'} role="tabpanel" id={`${id}-participants`} aria-labelledby={`${id}-participants-tab`}>
            <div className={tab === 'participants' ? 'tool-view' : ''}>{participants}</div>
          </div>
        </div>
      </section>
    </div>
  </ModalPortal>;
}
