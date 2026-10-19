import { defineConfig } from 'vitest/config';

// Tests dans un vrai navigateur (Chromium via Playwright) : ce que jsdom ne mesure pas — positions, hauteurs, plis.
// Commande à part (`npm run test:navigateur`), hors `npm test` et hors CI : elle demande un Chromium installé
// (`npx playwright install chromium`) et démarre elle-même le serveur Vite, l'API est simulée dans le test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests-navigateur/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
