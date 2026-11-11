import type { Poll, PollOption } from '../types/room';
import type { PollOptionResponse } from '../types/backend.types';

export function toPollOptions(options: PollOptionResponse[], votedOptionIds?: number[]): PollOption[] {
  return options.map(option => ({
    id: String(option.id),
    text: option.label,
    votes: option.voteCount,
    rankingScore: option.rankingScore,
    ratingValue: option.displayOrder + 1,
    votedByMe: votedOptionIds?.includes(option.id),
  }));
}

export function getPollResults(options: PollOption[], type: Poll['type'], sortRanking = true) {
  const ranked = type === 'RANKING';
  const rating = type === 'RATING';
  const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
  const score = (option: PollOption) => ranked ? option.rankingScore ?? 0 : option.votes;
  const topScore = Math.max(0, ...options.map(score));
  const leaders = !rating && topScore > 0 ? options.filter(option => score(option) === topScore) : [];
  const average = rating && totalVotes > 0
    ? options.reduce((sum, option, index) => sum + (option.ratingValue ?? index + 1) * option.votes, 0) / totalVotes
    : null;
  const ordered = ranked && sortRanking ? [...options].sort((a, b) => score(b) - score(a)) : options;
  const denominator = ranked ? topScore : totalVotes;
  return {
    ranked, rating, totalVotes, leaders, topScore,
    averageLabel: average === null ? null : `${average.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/5 sao`,
    rows: ordered.map(option => ({
      option,
      score: score(option),
      percentage: denominator ? Math.round(score(option) / denominator * 100) : 0,
      isLeader: !rating && topScore > 0 && score(option) === topScore,
    })),
  };
}

export function describePollResult(poll: Poll): string {
  const result = getPollResults(poll.options, poll.type);
  if (result.rating) {
    return result.averageLabel ? `${result.averageLabel} · ${result.totalVotes} lượt đánh giá` : 'Chưa có đánh giá';
  }
  if (!result.leaders.length) return 'Chưa có phiếu nào';
  const label = result.leaders.length > 1 ? 'Đồng dẫn đầu' : 'Dẫn đầu';
  return `${label} · ${result.leaders.map(option => option.text).join(', ')} · ${result.topScore} ${result.ranked ? 'điểm' : 'phiếu'}`;
}
