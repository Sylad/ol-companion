import { lazy, Suspense, type ComponentType } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { AppShell } from './components/layout/app-shell';
import { DashboardPage } from './routes/index';

const FixturesPage = lazyNamed(() => import('./routes/fixtures'), 'FixturesPage');
const StandingsPage = lazyNamed(() => import('./routes/standings'), 'StandingsPage');
const NewsPage = lazyNamed(() => import('./routes/news'), 'NewsPage');
const CupsPage = lazyNamed(() => import('./routes/cups'), 'CupsPage');
const PlayersPage = lazyNamed(() => import('./routes/players'), 'PlayersPage');
const PlayerDetailPage = lazyNamed(() => import('./routes/player.$athleteId'), 'PlayerDetailPage');
const FcNoobzPage = lazyNamed(() => import('./routes/fcnoobz'), 'FcNoobzPage');
const AboutPage = lazyNamed(() => import('./routes/about'), 'AboutPage');
const MatchPage = lazyNamed(() => import('./routes/match'), 'MatchPage');
const MapPage = lazyNamed(() => import('./routes/map'), 'MapPage');

function lazyNamed<TModule, TName extends keyof TModule>(
  loader: () => Promise<TModule>,
  name: TName,
) {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[name] as ComponentType };
  });
}

function RoutePending() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center text-fg-dim">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Chargement...
    </div>
  );
}

function withSuspense(Page: ComponentType) {
  return function LazyRoute() {
    return (
      <Suspense fallback={<RoutePending />}>
        <Page />
      </Suspense>
    );
  };
}

const rootRoute = createRootRoute({
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const fixturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fixtures',
  component: withSuspense(FixturesPage),
});

const standingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/standings',
  component: withSuspense(StandingsPage),
});

const newsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/news',
  component: withSuspense(NewsPage),
});

const cupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cups',
  component: withSuspense(CupsPage),
});

const playersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players',
  component: withSuspense(PlayersPage),
});

const playerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/player/$athleteId',
  component: withSuspense(PlayerDetailPage),
});

const fcnoobzRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fcnoobz',
  component: withSuspense(FcNoobzPage),
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: withSuspense(AboutPage),
});

const matchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/match/$gameId',
  component: withSuspense(MatchPage),
  validateSearch: (search: Record<string, unknown>): { matchupId?: string } => ({
    matchupId: typeof search.matchupId === 'string' ? search.matchupId : undefined,
  }),
});

const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/map',
  component: withSuspense(MapPage),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  fixturesRoute,
  standingsRoute,
  newsRoute,
  cupsRoute,
  playersRoute,
  playerDetailRoute,
  fcnoobzRoute,
  aboutRoute,
  matchRoute,
  mapRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
