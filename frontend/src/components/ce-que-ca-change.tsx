import { useId, type ReactNode } from 'react';
import { useMatchImpact } from '@/hooks/use-match-impact';
import { estIntrouvable } from '@/lib/api';
import { ceQueCaChange } from '@/lib/ce-que-ca-change';
import { cn } from '@/lib/utils';

/**
 * L265 — « Ce que ça change » sous un match de Ligue 1 terminé (page du match, « Dernier résultat »).
 * Données : football-data.org seul (`/api/match-impact`), la mention est portée par la page.
 * Pendant le chargement, le bloc réserve sa place (titre + deux lignes de phrase, `aria-busy`) : rien ne saute quand
 * la phrase arrive. Rien si football-data ne connaît pas le match (404) ; une panne ou un résultat pas
 * encore enregistré le disent, jamais un bloc vide.
 */
export function CeQueCaChange({ at, className }: { at: string; className?: string }) {
  const { data, error, isPending } = useMatchImpact(at);
  if (isPending && !error) {
    return (
      <Cadre className={className} enCours>
        <p data-testid="ce-que-ca-change-chargement" className="text-sm leading-snug min-h-[2.75em] text-fg-dim">Calcul du classement…</p>
      </Cadre>
    );
  }
  if (!data) {
    if (estIntrouvable(error)) return null;
    return (
      <Cadre className={className}>
        <p data-testid="ce-que-ca-change-erreur" className="text-sm text-fg-muted">
          Classement après le match indisponible pour l’instant.
        </p>
      </Cadre>
    );
  }
  const texte = ceQueCaChange(data);
  if (!texte) {
    return (
      <Cadre className={className}>
        <p data-testid="ce-que-ca-change-attente" className="text-sm text-fg-muted">
          Classement en attente du résultat officiel.
        </p>
      </Cadre>
    );
  }
  return (
    <Cadre className={className} provisoire={texte.provisoire !== null}>
      <p data-testid="ce-que-ca-change-phrase" className="text-sm text-fg-bright leading-snug">{texte.phrase}</p>
      {texte.provisoire && (
        <p data-testid="ce-que-ca-change-provisoire" className="mt-1 text-xs text-fg-muted leading-snug">{texte.provisoire}</p>
      )}
    </Cadre>
  );
}

function Cadre({ children, className, provisoire = false, enCours = false }: { children: ReactNode; className?: string; provisoire?: boolean; enCours?: boolean }) {
  const titre = useId();
  return (
    <section data-testid="ce-que-ca-change" aria-labelledby={titre} aria-busy={enCours || undefined} className={cn('px-5 py-3', className)}>
      <h2 id={titre} className="eyebrow mb-1 flex flex-wrap items-center gap-2">
        Ce que ça change
        {provisoire && (
          <span className="normal-case tracking-normal text-petite font-semibold px-1.5 py-0.5 rounded-sm border border-draw/40 text-draw-fg bg-draw/10">
            Provisoire
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
