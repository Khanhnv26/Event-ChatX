import type { DecisionCard } from '../../../types/room';

const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function DecisionMetadata({ decision }: { decision: DecisionCard }) {
  const wasConfirmed = decision.status === 'CONFIRMED' || decision.status === 'WITHDRAWN';
  const confirmedDate = decision.confirmedAt ? new Date(decision.confirmedAt) : null;
  const validDate = confirmedDate && Number.isFinite(confirmedDate.getTime()) ? confirmedDate : null;

  return <div className="my-2 space-y-1.5 text-xs text-muted-foreground">
    <dl className="space-y-1">
      <div className="flex flex-wrap gap-x-1">
        <dt>Đề xuất bởi:</dt>
        <dd className="min-w-0 font-medium text-foreground break-words [overflow-wrap:anywhere]">{decision.creatorNickname || 'Chưa ghi nhận'}</dd>
      </div>
      {wasConfirmed && <>
        <div className="flex flex-wrap gap-x-1">
          <dt>Người chốt:</dt>
          <dd className="min-w-0 font-medium text-foreground break-words [overflow-wrap:anywhere]">{decision.confirmedBy || 'Chưa ghi nhận'}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1">
          <dt>Chốt lúc:</dt>
          <dd>{validDate ? <time dateTime={decision.confirmedAt}>{dateTimeFormat.format(validDate)}</time> : 'Chưa ghi nhận'}</dd>
        </div>
      </>}
    </dl>
    <p className="font-medium text-accent-text">{decision.approveCount ?? 0} lượt tán thành</p>
  </div>;
}
