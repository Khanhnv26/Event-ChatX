import type { MessageMention } from '../types/backend.types';

export function replaceMentionRanges(mentions: MessageMention[], start: number, end: number, replacementLength: number): MessageMention[] {
  const shift = replacementLength - (end - start);
  return mentions.flatMap(mention => {
    if (mention.end <= start) return [mention];
    if (mention.start >= end) return [{ ...mention, start: mention.start + shift, end: mention.end + shift }];
    return [];
  });
}

export function updateMentionRanges(before: string, after: string, mentions: MessageMention[]): MessageMention[] {
  if (before === after || !mentions.length) return mentions;
  let prefix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix]) prefix++;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > prefix && newEnd > prefix && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return replaceMentionRanges(mentions, prefix, oldEnd, newEnd - prefix);
}

export function trimMentionRanges(body: string, mentions?: MessageMention[]): MessageMention[] | undefined {
  if (!mentions?.length) return undefined;
  const offset = body.length - body.trimStart().length;
  return mentions.map(mention => ({ ...mention, start: mention.start - offset, end: mention.end - offset }));
}
