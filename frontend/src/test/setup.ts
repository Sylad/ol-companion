import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Nettoie le DOM entre deux tests (les requêtes Testing Library ne débordent pas).
afterEach(() => {
  cleanup();
});

// L265 — « Ce que ça change » a sa propre requête (football-data.org). Partout, le hook répond « match
// inconnu de football-data » (404) : le bloc ne s'affiche pas et rien n'est appelé. Les tests de /match,
// dont plusieurs sont scellés (titres comptés, appels comptés), restent ainsi tels qu'avant L265. Les tests
// du bloc reprennent le vrai hook avec `vi.unmock('@/hooks/use-match-impact')`.
vi.mock('@/hooks/use-match-impact', async () => {
  const { ApiError } = await import('@/lib/api');
  return { useMatchImpact: () => ({ isPending: false, data: undefined, error: new ApiError(404, 'simulé (setup)') }) };
});
