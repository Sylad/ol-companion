import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './sidebar';

export function BottomNav() {
  const { location } = useRouterState();
  const path = location.pathname;
  const fcActive = path.startsWith('/fcnoobz');

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-7">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? path === item.to : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                active ? 'text-ol-red-bright' : 'text-fg-muted',
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[9px] font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
        <Link
          to="/fcnoobz"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors border-l border-border',
            fcActive ? 'text-[#3aa0ff]' : 'text-fg-muted',
          )}
        >
          <img
            src="/fcnoobz.png"
            alt=""
            aria-hidden
            className={cn(
              'h-[18px] w-[18px] object-contain transition-all',
              fcActive ? 'grayscale-0' : 'grayscale opacity-60',
            )}
          />
          <span
            className={cn(
              'text-[9px] font-bold tracking-wide',
              fcActive && 'text-[#1d4ed8] [-webkit-text-stroke:0.3px_#000]',
            )}
          >
            FC Noobz
          </span>
        </Link>
      </div>
    </nav>
  );
}
