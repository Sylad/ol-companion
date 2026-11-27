import { formatKickoffLong } from '@/lib/kickoff';
import type { NextOpponents } from '@/types/next-opponents';
import { FootballDataAttribution } from './football-data-attribution';
import { EMPTY_REASON_TEXT, LIVE_SHORT, VENUE_LONG, VENUE_SHORT } from './next-opponent-cell';
import { NEXT_LABEL, type VueTelephone } from './standings-table';

/** Au-delà de cet écart entre maintenant et le premier match programmé, la Ligue 1 est en trêve. */
export const TREVE_MS = 10 * 24 * 3600_000;
/** Copie de football-data plus vieille que ça : sa date est dite (invariant 4 des cartes : validité affichée). */
const STALE_MS = 60 * 60_000;

const PARIS = { timeZone: 'Europe/Paris' } as const;
function formatReleve(iso: string): string {
  const d = new Date(iso);
  const jour = new Intl.DateTimeFormat('fr-FR', { ...PARIS, day: 'numeric', month: 'short' }).format(d);
  const heure = new Intl.DateTimeFormat('fr-FR', { ...PARIS, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return `${jour} à ${heure}`;
}

/** Phrase de la prochaine journée : « Prochaine journée : J12, premier match vendredi 27 novembre · 20h45. » (ou trêve). */
export function prochaineJourneeText(data: NextOpponents, now: Date): string | null {
  const first = [...data.next].sort((a, b) => a.utcDate.localeCompare(b.utcDate))[0];
  if (!first) return null;
  // Une journée qui se joue n'est ni « prochaine » ni une trêve (revue de code de L273).
  if (first.live) return `Journée en cours${first.matchday !== null ? ` : J${first.matchday}` : ''}.`;
  const quand = formatKickoffLong({ date: first.utcDate, timeConfirmed: first.timeConfirmed });
  const quandMin = quand.charAt(0).toLowerCase() + quand.slice(1);
  const journee = first.matchday !== null ? `J${first.matchday}, ` : '';
  const treve = new Date(first.utcDate).getTime() - now.getTime() > TREVE_MS;
  return treve
    ? `Trêve : reprise ${journee}premier match ${quandMin}.`
    : `Prochaine journée : ${journee}premier match ${quandMin}.`;
}

/**
 * L273 — légende de la colonne « Prochain » : ce qu'elle montre, ce que veulent dire Dom. / Ext. (les mêmes
 * libellés que les cases), la journée qui vient ou la trêve, la fin de saison, l'échec, et la source
 * (mention exigée par football-data, § 7.1) quand une donnée de football-data est affichée.
 */
export function NextOpponentsNote({ query, vueTelephone }: { query: { data?: NextOpponents; isError: boolean }; vueTelephone: VueTelephone }) {
  const { data } = query;
  if (!data) {
    if (!query.isError) return null;
    return (
      <p data-testid="prochain-indisponible" className="mt-3 px-2 text-xs text-fg-muted">
        {EMPTY_REASON_TEXT.unavailable}.
      </p>
    );
  }
  const now = new Date();
  const releve = now.getTime() - new Date(data.updatedAt).getTime() > STALE_MS ? ` (relevé du ${formatReleve(data.updatedAt)})` : '';
  return (
    <div className="mt-3 px-2 space-y-1 text-xs text-fg-dim" data-testid="legende-prochain">
      {data.seasonOver ? (
        <p>{EMPTY_REASON_TEXT['season-over']}.</p>
      ) : (
        <p>
          <span className="font-semibold text-fg-muted">
            <span className="md:hidden">{NEXT_LABEL.phone}</span>
            <span className="hidden md:inline">{NEXT_LABEL.desktop}</span>
          </span>{' '}
          : adversaire du prochain match de Ligue 1 programmé
          {vueTelephone === 'bilan' && <span className="md:hidden"> (vue « Prochain »)</span>} —{' '}
          <span className="text-fg-muted">{VENUE_SHORT.home}</span> {VENUE_LONG.home},{' '}
          <span className="text-fg-muted">{VENUE_SHORT.away}</span> {VENUE_LONG.away}
          {data.next.some((n) => n.live) && (
            <>
              , <span className="font-semibold text-live">{LIVE_SHORT}</span> match en cours
            </>
          )}
          . {prochaineJourneeText(data, now)}
        </p>
      )}
      <p className="text-petite leading-snug">
        Prochains adversaires{releve} : <FootballDataAttribution />.
      </p>
    </div>
  );
}
