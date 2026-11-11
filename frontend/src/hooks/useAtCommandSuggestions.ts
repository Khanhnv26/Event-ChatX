import { useId, useState, type KeyboardEvent, type RefObject } from 'react';
import type { MessageMention } from '../types/backend.types';
import type { Participant } from '../types/room';
import { replaceMentionRanges, updateMentionRanges } from '../services/messageMentions';

export interface AtCommand {
  text: string;
  description: string;
  startsMessage?: boolean;
  guestId?: string;
  everyone?: boolean;
  requiresImage?: boolean;
}

const EVERYONE: AtCommand = { text: '@Everyone', description: 'Nhắc tất cả thành viên trong phòng', everyone: true };

const COMMANDS: AtCommand[] = [
  { text: '@ai', description: 'Hỏi AI Co-Host' },
  { text: '@ai tóm tắt thảo luận', description: 'Tóm tắt tin nhắn trong cuộc thảo luận', startsMessage: true },
  { text: '@ai gợi ý các bước tiếp theo', description: 'Đề xuất việc cần làm sau cuộc thảo luận' },
  { text: '@ai phân tích ảnh này', description: 'Đọc và giải thích ảnh đính kèm hoặc được trích dẫn', requiresImage: true },
];

type ComposerField = HTMLInputElement | HTMLTextAreaElement;
const TOKEN = /(?:^|\s)(@[\p{L}\p{M}\p{N}_.-]*)$/u;
const TOKEN_SUFFIX = /^[\p{L}\p{M}\p{N}_.-]*/u;
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd');

export function useAtCommandSuggestions<T extends ComposerField>(
  field: RefObject<T | null>, text: string, mentions: MessageMention[],
  changeText: (value: string, mentions: MessageMention[]) => void, enabled: boolean,
  members: Participant[], hasImage = false,
) {
  const listId = useId();
  const [caret, setCaret] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<{ text: string; caret: number | null } | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const prefix = caret === null ? '' : text.slice(0, caret);
  const match = enabled && caret !== null && !mentions.some(mention => mention.start < caret && mention.end >= caret)
    ? TOKEN.exec(prefix) : null;
  const token = match?.[1] ?? '';
  const start = prefix.length - token.length;
  const aiOptions = token ? COMMANDS.filter(command => command.text.startsWith(token.toLowerCase())
    && (!command.startsMessage || !text.slice(0, start).trim()) && (!command.requiresImage || hasImage)) : [];
  const query = normalize(token.slice(1));
  const memberOptions = token && mentions.length < 20 ? members
    .filter(member => normalize(member.nickname).split(/\s+/).some(word => word.startsWith(query)))
    .slice(0, 8)
    .map(member => {
      const duplicate = members.some(other => other.id !== member.id && normalize(other.nickname) === normalize(member.nickname));
      return {
        guestId: member.id,
        text: `@${member.nickname}`,
        description: `${member.role === 'HOST' ? 'Host' : 'Thành viên'}${duplicate ? ` · ${member.id.slice(-6)}` : ''}`,
      };
    }) : [];
  const everyoneOptions = token && mentions.length < 20 && EVERYONE.text.toLowerCase().startsWith(token.toLowerCase())
    ? [EVERYONE] : [];
  const options = query === 'ai' ? [...aiOptions, ...memberOptions]
    : query ? [...everyoneOptions, ...memberOptions, ...aiOptions] : [...memberOptions, ...aiOptions, ...everyoneOptions];
  const open = options.length > 0 && !(dismissed?.text === text && dismissed.caret === caret);
  const selected = Math.min(highlighted, options.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;

  const dismiss = () => {
    setDismissed({ text, caret });
    setCaret(null);
    setHighlighted(0);
  };

  const track = (input: ComposerField) => {
    const position = input.selectionStart;
    setCaret(position === input.selectionEnd ? position : null);
  };

  const edit = (value: string) => {
    setHighlighted(0);
    changeText(value, updateMentionRanges(text, value, mentions));
  };

  const choose = (command: AtCommand) => {
    if (!open || caret === null) return;
    const suffix = text.slice(caret).replace(TOKEN_SUFFIX, '');
    const replacement = command.text + (/^\s/.test(suffix) ? '' : ' ');
    const next = text.slice(0, start) + replacement + suffix;
    if (next.length > 2048) return;
    const nextMentions = replaceMentionRanges(mentions, start, text.length - suffix.length, replacement.length);
    const end = start + command.text.length;
    if (command.everyone) nextMentions.push({ everyone: true, start, end });
    else if (command.guestId) nextMentions.push({ guestId: command.guestId, start, end });
    changeText(next, nextMentions.sort((a, b) => a.start - b.start));
    field.current?.focus({ preventScroll: true });
    dismiss();
    window.requestAnimationFrame(() => {
      const input = field.current;
      if (input?.value === next && document.activeElement === input) {
        input.setSelectionRange(end + 1, end + 1);
        dismiss();
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<T>) => {
    if (!open || event.nativeEvent.isComposing || event.keyCode === 229) return false;
    const key = event.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      setHighlighted((selected + (key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
    } else if (key === 'Escape') {
      dismiss();
      event.stopPropagation();
    } else if ((key === 'Enter' || key === 'Tab') && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (!event.repeat) choose(options[selected]);
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  };

  return { open, listId, optionId, options, selected, choose, dismiss, track, edit, handleKeyDown,
    listLabel: 'Gợi ý thành viên và lệnh AI' };
}
