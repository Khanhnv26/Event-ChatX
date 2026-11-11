import { Fragment, type ReactNode } from 'react';
import type { MessageMention } from '../../types/backend.types';

export function MessageText({ text, mentions }: { text: string; mentions?: MessageMention[] }) {
  if (!mentions?.length) return text;
  let cursor = 0;
  const segments: ReactNode[] = [];
  for (const mention of mentions) {
    const { start, end } = mention;
    if (start < cursor || end <= start || end > text.length) continue;
    const preceding = text.slice(cursor, start);
    cursor = end;
    segments.push(<Fragment key={start}>
      {preceding}<strong className="font-bold">{text.slice(start, end)}</strong>
    </Fragment>);
  }
  return <>{segments}{text.slice(cursor)}</>;
}
