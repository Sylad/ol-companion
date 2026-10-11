import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { acceptationOnly } from './tests/acceptation-runner.mjs';

// Commande dédiée (orchestrate.accept) : seulement les fichiers du lot (CADENCE_ACCEPTATION).
// Les chemins de l'acceptation sont relatifs à la racine du dépôt.
const root = path.resolve(__dirname, '..');
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: acceptationOnly().map((f) => path.resolve(root, f)),
  },
});
