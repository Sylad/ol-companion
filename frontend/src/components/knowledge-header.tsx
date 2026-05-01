import { useWikiImage } from '@/hooks/use-wiki-image';
import { useStandings } from '@/hooks/use-standings';
import { OL_TEAM_ID } from '@/types/api';

const POSITION_SUFFIX = ['e', 'er', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e'];

function ordinal(pos: number): string {
  if (pos === 1) return '1er';
  return `${pos}${POSITION_SUFFIX[pos % 10] ?? 'e'}`;
}

export function KnowledgeHeader() {
  const { data: logo } = useWikiImage('Olympique lyonnais');
  const { data: standings } = useStandings();

  const olRow = standings?.table.find((row) => row.teamId === OL_TEAM_ID);
  const subtitle = olRow
    ? `${ordinal(olRow.position)} de Ligue 1 · ${olRow.points} pts`
    : 'Ligue 1 · saison en cours';

  return (
    <header className="flex items-center gap-5 pb-6 border-b border-border">
      <div className="shrink-0 w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-white/5 border border-border flex items-center justify-center overflow-hidden">
        {logo?.imageUrl ? (
          <img src={logo.imageUrl} alt="OL" className="w-full h-full object-contain p-1.5" />
        ) : (
          <span className="font-display font-bold text-fg-dim">OL</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl lg:text-[34px] font-bold text-fg-bright leading-tight tracking-tight">
          Olympique Lyonnais
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
      </div>
    </header>
  );
}
