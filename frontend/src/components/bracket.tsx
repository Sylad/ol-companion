import { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import type { BracketInfo, BracketMatch as BracketMatchType, BracketStage } from '@/types/api';
import { BracketMatch } from './bracket-match';
import { BracketTie } from './bracket-tie';

interface Props { bracket: BracketInfo }

type StageItem =
  | { kind: 'tie'; key: string; matches: [BracketMatchType, BracketMatchType] }
  | { kind: 'single'; key: string; match: BracketMatchType };

function pairTwoLegs(stage: BracketStage): StageItem[] {
  const groups = new Map<string, BracketMatchType[]>();
  for (const m of stage.matches) {
    const key = [m.homeTeamId, m.awayTeamId].sort((a, b) => a - b).join('-');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const items: StageItem[] = [];
  for (const [key, matches] of groups) {
    if (matches.length === 2) {
      items.push({ kind: 'tie', key, matches: matches as [BracketMatchType, BracketMatchType] });
    } else {
      for (const m of matches) {
        items.push({ kind: 'single', key: `${key}-${m.id}`, match: m });
      }
    }
  }

  // Preserve original order via earliest match date in each group
  items.sort((a, b) => {
    const aDate = a.kind === 'tie'
      ? Math.min(...a.matches.map((m) => new Date(m.date).getTime()))
      : new Date(a.match.date).getTime();
    const bDate = b.kind === 'tie'
      ? Math.min(...b.matches.map((m) => new Date(m.date).getTime()))
      : new Date(b.match.date).getTime();
    return aDate - bDate;
  });

  return items;
}

function StageItemRender({ item }: { item: StageItem }) {
  if (item.kind === 'tie') return <BracketTie matches={item.matches} />;
  return <BracketMatch match={item.match} />;
}

function BracketDesktopLayout({ stagesWithItems, columnWidthClass }: {
  stagesWithItems: { stage: BracketStage; items: StageItem[] }[];
  columnWidthClass: string;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:thin]">
      {stagesWithItems.map(({ stage, items }) => (
        <div key={stage.stageNum} className={`shrink-0 ${columnWidthClass}`}>
          <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2 text-center">
            {stage.stageFr}
          </div>
          <div className="flex flex-col gap-3 justify-around">
            {items.map((it) => (
              <StageItemRender key={it.key} item={it} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Bracket({ bracket }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  if (!bracket.stages.length) return null;

  const stagesWithItems = bracket.stages.map((s) => ({ stage: s, items: pairTwoLegs(s) }));

  return (
    <>
      <div className="rounded-md border border-border bg-surface-2 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="eyebrow">Tableau</div>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="hidden md:inline-flex items-center gap-1 text-xs text-fg-dim hover:text-fg transition-colors px-1.5 py-0.5 rounded"
            aria-label="Ouvrir le tableau en plein écran"
            title="Plein écran (Échap pour fermer)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Plein écran</span>
          </button>
        </div>
        {/* Desktop: horizontal columns per stage with horizontal scroll on narrow cards */}
        <div className="hidden md:block relative">
          <BracketDesktopLayout stagesWithItems={stagesWithItems} columnWidthClass="w-44" />
          {/* Right edge gradient hint when content overflows */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-surface-2 to-transparent"
          />
        </div>
        {/* Mobile: vertical stack per stage */}
        <div className="md:hidden space-y-3">
          {stagesWithItems.map(({ stage, items }) => (
            <div key={stage.stageNum}>
              <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1.5">
                {stage.stageFr}
              </div>
              <div className="space-y-2">
                {items.map((it) => (
                  <StageItemRender key={it.key} item={it} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[300] bg-bg/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="relative w-[95vw] max-w-7xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-surface-2 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow">Tableau — Plein écran</div>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="inline-flex items-center gap-1 text-xs text-fg-dim hover:text-fg transition-colors p-1 rounded"
                aria-label="Fermer"
                title="Fermer (Échap)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <BracketDesktopLayout stagesWithItems={stagesWithItems} columnWidthClass="w-56" />
          </div>
        </div>
      )}
    </>
  );
}
