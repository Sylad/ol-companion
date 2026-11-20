import { useId, type ReactNode } from 'react';
import { useMatchImpact } from '@/hooks/use-match-impact';
import { estIntrouvable } from '@/lib/api';
import { ceQueCaChange } from '@/lib/ce-que-ca-change';
import { cn } from '@/lib/utils';

/**
 * L265 — « Ce que ça change » sous un match de Ligue 1 terminé (page du match, « Dernier résultat »).
 * Données : football-data.org seul (`/api/match-impact`), la mention est portée par la page.
 * Place réservée : le titre a toujours la hauteur du badge « Provisoire ». Avec `gabarit` (page du match, revue UX r1,
 * M1 : le mini-classement sautait de 124 px), le corps superpose, invisible, le cas le plus long (phrase la plus longue
 * que forme `ceQueCaChange` + ligne « Classement provisoire ») au contenu réel : même hauteur en chargement, chargé
 * (avec ou sans « Provisoire »), en panne ou en attente, à toute largeur, rien ne saute. Le gabarit est écrit en CSS
 * (`content`), pas dans le DOM : aucun texte en double pour un lecteur d'écran ni pour une recherche de texte. Sans
 * `gabarit` (accueil : le bloc y est au-dessus de la carte suivante et le cas le plus long laisserait 60 px vides sous
 * la phrase courante à 390 px), le chargement réserve deux lignes de phrase (écart mesuré ≤ 20 px, accepté en revue).
 * Rien si football-data ne connaît pas le match (404) ; une panne ou un résultat pas encore enregistré le disent,
 * jamais un bloc vide. `titre` : h2 sur la page du match (bloc du même rang que les autres), h3 dans la carte
 * « Dernier résultat » de l'accueil, dont le h2 est le titre de la carte (WCAG 1.3.1).
 */
export function CeQueCaChange({ at, className, titre = 'h2', gabarit = false }: { at: string; className?: string; titre?: 'h2' | 'h3'; gabarit?: boolean }) {
  const { data, error, isPending } = useMatchImpact(at);
  if (isPending && !error) {
    return (
      <Cadre className={className} titre={titre} gabarit={gabarit} enCours>
        <p data-testid="ce-que-ca-change-chargement" className={cn('text-sm leading-snug text-fg-dim', !gabarit && 'min-h-[2.75em]')}>Calcul du classement…</p>
      </Cadre>
    );
  }
  if (!data) {
    if (estIntrouvable(error)) return null;
    return (
      <Cadre className={className} titre={titre} gabarit={gabarit}>
        <p data-testid="ce-que-ca-change-erreur" className="text-sm leading-snug text-fg-muted">
          Classement après le match indisponible pour l’instant.
        </p>
      </Cadre>
    );
  }
  const texte = ceQueCaChange(data);
  if (!texte) {
    return (
      <Cadre className={className} titre={titre} gabarit={gabarit}>
        <p data-testid="ce-que-ca-change-attente" className="text-sm leading-snug text-fg-muted">
          Classement en attente du résultat officiel.
        </p>
      </Cadre>
    );
  }
  return (
    <Cadre className={className} titre={titre} gabarit={gabarit} provisoire={texte.provisoire !== null}>
      <p data-testid="ce-que-ca-change-phrase" className="text-sm text-fg-bright leading-snug">{texte.phrase}</p>
      {texte.provisoire && (
        <p data-testid="ce-que-ca-change-provisoire" className="mt-1 text-xs text-fg-muted leading-snug">{texte.provisoire}</p>
      )}
    </Cadre>
  );
}

/** Le cas le plus long que forme `ceQueCaChange` : début sans place d'avant (« Lyon est 12e à l’issue de la 10e
 *  journée », plus long que « Lyon passe de 11e à 12e »), les deux zones aux noms les plus longs, écarts à deux
 *  chiffres, journées 1 à N incomplètes. Il ne s'affiche jamais : il donne sa hauteur au bloc. */
const CAS_LE_PLUS_LONG = ceQueCaChange({
  matchday: 10, finished: true, homeTeam: 'Lyon', awayTeam: 'Lyon', score: { home: 0, away: 0 },
  before: null, after: { position: 12, points: 0 },
  remaining: 12, remainingInMatchday: 1,
  above: { place: 3, gap: 10 }, below: { place: 15, margin: 10 },
  updatedAt: '',
})!;

function Cadre({ children, className, titre: Titre, gabarit, provisoire = false, enCours = false }: { children: ReactNode; className?: string; titre: 'h2' | 'h3'; gabarit: boolean; provisoire?: boolean; enCours?: boolean }) {
  const titre = useId();
  return (
    <section data-testid="ce-que-ca-change" aria-labelledby={titre} aria-busy={enCours || undefined} className={cn('px-5 py-3', className)}>
      {/* min-h : la hauteur du badge, qu'il soit là ou non (le titre ne grandit pas quand il arrive). */}
      <Titre id={titre} className="eyebrow mb-1 flex flex-wrap items-center gap-2 min-h-[1.375rem]">
        Ce que ça change
        {provisoire && (
          <span
            data-testid="ce-que-ca-change-badge"
            className="normal-case tracking-normal text-petite font-semibold px-1.5 py-0.5 rounded-sm border border-border text-fg-muted bg-surface-2"
          >
            Provisoire
          </span>
        )}
      </Titre>
      {gabarit ? (
        <div data-testid="ce-que-ca-change-corps" className="grid [&>*]:[grid-area:1/1]">
          <div data-testid="ce-que-ca-change-gabarit" aria-hidden="true" className="invisible pointer-events-none select-none">
            <p className="text-sm leading-snug before:content-[attr(data-gabarit)]" data-gabarit={CAS_LE_PLUS_LONG.phrase} />
            <p className="mt-1 text-xs leading-snug before:content-[attr(data-gabarit)]" data-gabarit={CAS_LE_PLUS_LONG.provisoire ?? ''} />
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      ) : children}
    </section>
  );
}
