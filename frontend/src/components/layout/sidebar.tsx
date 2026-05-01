import { Link, useRouterState } from '@tanstack/react-router';
import { Home, CalendarDays, ListOrdered, Newspaper, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarLinks } from './sidebar-links';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Home, exact: true },
  { to: '/fixtures', label: 'Calendrier', icon: CalendarDays, exact: false },
  { to: '/standings', label: 'Classement', icon: ListOrdered, exact: false },
  { to: '/players', label: 'Joueurs', icon: Users, exact: false },
  { to: '/news', label: 'Actu', icon: Newspaper, exact: false },
  { to: '/cups', label: 'Coupes', icon: Trophy, exact: false },
] as const;

export function Sidebar() {
  const { location } = useRouterState();
  const path = location.pathname;

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[240px] flex-col bg-surface z-40">
      {/* Neon edge — RED top half */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-[52%] w-px"
        style={{
          background:
            'linear-gradient(180deg, hsl(0 95% 65% / 0.95) 0%, hsl(0 90% 60% / 0.7) 60%, hsl(0 80% 50% / 0) 100%)',
          boxShadow:
            '0 0 8px 0.5px hsl(0 95% 60% / 0.7), 0 0 18px 1px hsl(0 95% 55% / 0.45), 0 0 36px 2px hsl(0 90% 50% / 0.2)',
        }}
      />
      {/* Neon edge — BLUE bottom half */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-[52%] w-px"
        style={{
          background:
            'linear-gradient(0deg, hsl(224 95% 65% / 0.95) 0%, hsl(224 90% 60% / 0.7) 60%, hsl(224 80% 50% / 0) 100%)',
          boxShadow:
            '0 0 8px 0.5px hsl(224 95% 60% / 0.7), 0 0 18px 1px hsl(224 95% 55% / 0.45), 0 0 36px 2px hsl(224 90% 50% / 0.2)',
        }}
      />

      <div className="px-5 pt-6 pb-7">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/icon.png"
            alt="OL Companion"
            className="w-12 h-12 shrink-0 rounded-md transition-transform group-hover:scale-105 shadow-[0_0_18px_rgba(220,38,38,0.25)]"
          />
          <div className="min-w-0">
            <div className="font-display text-base font-bold tracking-tight text-fg-bright leading-none">
              OL Companion
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim mt-1 font-semibold">
              Olympique Lyonnais
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? path === item.to : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-surface-2 text-fg-bright'
                  : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-sm bg-ol-red" />
              )}
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span
                className={cn(
                  'font-medium',
                  active && 'text-fg-bright [-webkit-text-stroke:0.2px_rgba(201,162,74,0.85)]',
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Divider then FC Noobz */}
        <div className="my-3 mx-3 h-px bg-border" />
        <FcNoobzLink active={path.startsWith('/fcnoobz')} />
      </nav>

      <div className="border-t border-border pt-3">
        <SidebarLinks />
      </div>

      <div className="px-6 py-3 border-t border-border">
        <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">v2.0</div>
      </div>
    </aside>
  );
}

function FcNoobzLink({ active }: { active: boolean }) {
  return (
    <Link
      to="/fcnoobz"
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all',
        active
          ? 'bg-[#03040a] text-[#3aa0ff]'
          : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-sm bg-[#84cc16] shadow-[0_0_10px_rgba(132,204,22,0.6)]" />
      )}
      <img
        src="/fcnoobz.png"
        alt=""
        aria-hidden
        className={cn(
          'h-[20px] w-[20px] shrink-0 object-contain transition-all',
          active
            ? 'grayscale-0 drop-shadow-[0_0_4px_rgba(132,204,22,0.7)]'
            : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-90',
        )}
      />
      <span
        className={cn(
          'font-bold tracking-wide',
          active &&
            'text-[#1d4ed8] [-webkit-text-stroke:0.4px_#000] [text-shadow:0_0_8px_rgba(132,204,22,0.45)]',
        )}
      >
        FC Noobz
      </span>
    </Link>
  );
}
