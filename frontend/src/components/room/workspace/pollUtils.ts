import type { Poll } from '../../../types/room';

/** A poll is displayable once the backend has returned a real id and at least one option. */
export const isActivePoll = (poll?: Poll | null): poll is Poll =>
  Boolean(poll && poll.id && poll.id !== '0' && poll.id !== 'empty' && poll.options?.length > 0);

export const POLL_CARD_SELECTOR = '[data-poll-card="true"]';
