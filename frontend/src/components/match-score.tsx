import { scoreText } from '@/lib/match-score';
import type { LiveMatchSide, LiveMatchStatus } from '@/types/api';

/** Score « 2 · 1 », ou « vs » tant que le match n'a pas de score (L77). */
export function MatchScore({ home, away, status, sepClass = 'mx-1.5' }: {
  home: Pick<LiveMatchSide, 'score'>;
  away: Pick<LiveMatchSide, 'score'>;
  status: LiveMatchStatus;
  sepClass?: string;
}) {
  const text = scoreText(home, away, status);
  if (!text) return <span className="text-fg-dim" aria-label="Match pas encore commencé">vs</span>;
  return <>{text[0]}<span className={`text-fg-dim ${sepClass}`}>·</span>{text[1]}</>;
}
