import type { BracketInfo } from '@/types/api';
import { BracketMatch } from './bracket-match';

interface Props { bracket: BracketInfo }

export function Bracket({ bracket }: Props) {
  if (!bracket.stages.length) return null;

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="eyebrow mb-2">Tableau</div>
      {/* Desktop: horizontal columns per stage */}
      <div className="hidden md:flex gap-3">
        {bracket.stages.map((stage) => (
          <div key={stage.stageNum} className="flex-1 min-w-[180px]">
            <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2 text-center">
              {stage.stageFr}
            </div>
            <div className="flex flex-col gap-3 justify-around h-full">
              {stage.matches.map((m) => (
                <BracketMatch key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Mobile: vertical stack per stage */}
      <div className="md:hidden space-y-3">
        {bracket.stages.map((stage) => (
          <div key={stage.stageNum}>
            <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1.5">
              {stage.stageFr}
            </div>
            <div className="space-y-2">
              {stage.matches.map((m) => (
                <BracketMatch key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
