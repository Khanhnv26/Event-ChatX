import { useEffect, useRef } from 'react';
import { AtSign, Sparkles, Users } from 'lucide-react';
import type { AtCommand } from '../../hooks/useAtCommandSuggestions';

interface AtCommandSuggestionsProps {
  listId: string;
  listLabel: string;
  optionId: (index: number) => string;
  options: AtCommand[];
  selected: number;
  choose: (command: AtCommand) => void;
}

export function AtCommandSuggestions({ listId, listLabel, optionId, options, selected, choose }: AtCommandSuggestionsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [selected]);

  return <ul ref={listRef} id={listId} role="listbox" aria-label={listLabel} data-native-scroll
    className="absolute inset-x-0 bottom-full z-40 mb-2 max-h-[min(12rem,40dvh)] max-w-sm overflow-y-auto rounded-xl border border-border bg-card p-1 text-foreground shadow-xl">
    {options.map((command, index) => {
      const Icon = command.everyone ? Users : command.guestId ? AtSign : Sparkles;
      return <li key={command.guestId ?? command.text} id={optionId(index)} role="option" aria-selected={index === selected}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(command)}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-card-muted aria-selected:bg-primary-soft">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <strong className="block break-words text-xs font-bold text-primary-text">{command.text}</strong>
          <span className="block text-xs text-muted-foreground">{command.description}</span>
        </span>
      </li>;
    })}
  </ul>;
}
