import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { acceptationIgnored } from './tests/acceptation-runner.mjs';

// L'app affiche l'heure de Paris : les tests la lisent dans ce fuseau quel que soit celui de
// la machine (le runner GitHub est en UTC). Posé avant le démarrage des workers, qui l'héritent.
process.env.TZ = 'Europe/Paris';

// Config Vitest à part (modèle finance-tracker) : le build (tsc -b && vite build)
// ne voit pas les champs de test. Lancer : npm test.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
    // Tests d'acceptation des lots pas encore verts (docs/specs/*/acceptation-<lot>.json, vert: false).
    exclude: [...configDefaults.exclude, ...acceptationIgnored(path.resolve(__dirname, '..')).map((f) => path.relative(__dirname, path.resolve(__dirname, '..', f)))],
  },
});
