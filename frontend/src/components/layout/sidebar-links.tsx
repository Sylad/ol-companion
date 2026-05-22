import { Globe, Newspaper, Youtube, BarChart3, ExternalLink, Sparkles } from 'lucide-react';
import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

interface ExternalSource {
  href: string;
  label: string;
  icon: typeof Globe;
}

const SOURCES: ExternalSource[] = [
  { href: 'https://www.ol.fr/fr', label: 'OL.fr', icon: Globe },
  {
    href: 'https://www.olympique-et-lyonnais.com/rubrique/une',
    label: 'OL News',
    icon: Newspaper,
  },
  {
    href: 'https://www.youtube.com/@OlympiqueLyonnais',
    label: 'OL officiel YouTube',
    icon: Youtube,
  },
  {
    href: 'https://www.sofascore.com/fr/football/team/olympique-lyonnais/1649',
    label: 'Sofascore',
    icon: BarChart3,
  },
];

export function SidebarLinks() {
  const { location } = useRouterState();
  const aboutActive = location.pathname.startsWith('/about');

  return (
    <div className="px-3 pb-2 space-y-0.5">
      <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-fg-dim font-semibold">
        Ressources
      </div>
      {SOURCES.map((s) => (
        <a
          key={s.href}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-md px-3 py-2 text-xs text-fg-muted hover:bg-surface-2/60 hover:text-fg transition-colors"
        >
          <s.icon className="h-[14px] w-[14px] shrink-0" strokeWidth={1.75} />
          <span className="flex-1 truncate">{s.label}</span>
          <ExternalLink
            className="h-[11px] w-[11px] opacity-0 group-hover:opacity-60 transition-opacity"
            strokeWidth={2}
          />
        </a>
      ))}

      <div className="my-2 mx-3 h-px bg-border" />

      <Link
        to="/about"
        className={cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-xs transition-colors',
          aboutActive
            ? 'bg-surface-2 text-fg-bright'
            : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
        )}
      >
        <Sparkles
          className={cn('h-[14px] w-[14px] shrink-0', aboutActive && 'text-ol-red-bright')}
          strokeWidth={1.75}
        />
        <span className="flex-1 truncate">À propos</span>
      </Link>
    </div>
  );
}
