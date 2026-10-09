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
  if (!text) {
    return (
      <span className="text-fg-dim">
        <span aria-hidden="true">vs</span>
        <span className="sr-only">{status === 'upcoming' ? 'Match pas encore commencé' : 'Score indisponible'}</span>
      </span>
    );
  }
  return <>{text[0]}<span className={`text-fg-dim ${sepClass}`}>·</span>{text[1]}</>;
}
