import { Globe, Newspaper, Youtube, BarChart3, ExternalLink, Sparkles, Megaphone, ListTodo } from 'lucide-react';
import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { NewsBadge } from '@/components/news-badge';
import { useNewsBadge } from '@/hooks/use-news-badge';

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

// Pages internes du bas de la barre latérale ; au téléphone, dans « Plus » (bottom-nav).
export const SECONDARY_ITEMS = [
  { to: '/nouveautes', label: 'Nouveautés', icon: Megaphone },
  { to: '/plan', label: 'Plan de travail', icon: ListTodo },
  { to: '/about', label: 'À propos', icon: Sparkles },
] as const;

export const GROUP_TITLE = 'px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-fg-dim font-semibold';

export function SidebarLinks() {
  const { location } = useRouterState();
  const news = useNewsBadge();

  return (
    <div className="px-3 pb-2 space-y-0.5">
      {/* Pages de l'application elle-même (L13) : séparées des « Ressources », liens externes. */}
      <div role="group" aria-labelledby="sidebar-group-application" className="space-y-0.5">
        <div id="sidebar-group-application" className={GROUP_TITLE}>
          Application
        </div>
        {SECONDARY_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-xs transition-colors',
                active
                  ? 'bg-surface-2 text-fg-bright'
                  : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
              )}
            >
              <Icon
                className={cn('h-[14px] w-[14px] shrink-0', active && 'text-ol-red-bright')}
                strokeWidth={1.75}
              />
              <span className="flex-1 truncate">{label}</span>
              {to === '/nouveautes' && <NewsBadge badge={news.badge} label={news.label} className="h-4 min-w-4 shrink-0" />}
            </Link>
          );
        })}
      </div>

      <div className="my-2 mx-3 h-px bg-border" />

      <div role="group" aria-labelledby="sidebar-group-ressources" className="space-y-0.5">
        <div id="sidebar-group-ressources" className={GROUP_TITLE}>
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
      </div>
    </div>
  );
}
