import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { AppShell } from './components/layout/app-shell';
import { DashboardPage } from './routes/index';
import { FixturesPage } from './routes/fixtures';
import { StandingsPage } from './routes/standings';
import { NewsPage } from './routes/news';
import { CupsPage } from './routes/cups';
import { PlayersPage } from './routes/players';
import { FcNoobzPage } from './routes/fcnoobz';
import { AboutPage } from './routes/about';
import { MatchPage } from './routes/match';

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
  component: FixturesPage,
});

const standingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/standings',
  component: StandingsPage,
});

const newsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/news',
  component: NewsPage,
});

const cupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cups',
  component: CupsPage,
});

const playersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players',
  component: PlayersPage,
});

const fcnoobzRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fcnoobz',
  component: FcNoobzPage,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: AboutPage,
});

const matchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/match/$gameId',
  component: MatchPage,
  validateSearch: (search: Record<string, unknown>): { matchupId?: string } => ({
    matchupId: typeof search.matchupId === 'string' ? search.matchupId : undefined,
  }),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  fixturesRoute,
  standingsRoute,
  newsRoute,
  cupsRoute,
  playersRoute,
  fcnoobzRoute,
  aboutRoute,
  matchRoute,
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
