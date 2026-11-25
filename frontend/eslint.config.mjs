// @ts-check
// ESLint du frontend (L270, D-31) : adopté pour cadence analyse, existant figé dans .cadence/analyse/eslint-frontend.json.
// Règles typées sur ce que couvre tsconfig.json (src/, vite.config.ts) ; le reste (tests navigateur, scripts, configs,
// service worker) sans types. Les seuils de taille et de lisibilité de cadence valent partout.
import eslint from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const typedFiles = ['src/**/*.{ts,tsx}', 'vite.config.ts'];

export default tseslint.config(
  { ignores: ['node_modules/', 'dist/', 'coverage/', '.vitest/', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser } } },
  { files: ['scripts/**', 'tests/**', 'tests-navigateur/**', '*.config.{js,ts}'], languageOptions: { globals: { ...globals.node } } },
  { files: ['public/sw.js'], languageOptions: { globals: { ...globals.serviceworker } } },
  {
    files: typedFiles,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
  {
    plugins: { sonarjs },
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      complexity: ['error', 15],
      'sonarjs/cognitive-complexity': ['error', 15],
    },
  },
);
