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

export function Bracket({ bracket }: Props) {
  if (!bracket.stages.length) return null;

  const stagesWithItems = bracket.stages.map((s) => ({ stage: s, items: pairTwoLegs(s) }));

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="eyebrow mb-2">Tableau</div>
      {/* Desktop: horizontal columns per stage with horizontal scroll on narrow cards */}
      <div className="hidden md:block relative">
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {stagesWithItems.map(({ stage, items }) => (
            <div key={stage.stageNum} className="shrink-0 w-44">
              <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2 text-center">
                {stage.stageFr}
              </div>
              <div className="flex flex-col gap-3 justify-around h-full">
                {items.map((it) => (
                  <StageItemRender key={it.key} item={it} />
                ))}
              </div>
            </div>
          ))}
        </div>
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
  );
}
