# Montée Vitest 2 → 5, Vite 5 → 8, @vitejs/plugin-react 4 → 6 (L250, 2026-11-17)

But : fermer les 6 failles restantes du frontend (`npm audit` : 3 modérées, 1 haute, 2 critiques —
esbuild ≤ 0.24.2 du serveur de dev, tinypool ≤ 2.1.1, @vitest/mocker, vite ≤ 6.4.3, vite-node, vitest ≤ 4.1.10).
Après : `npm audit` → 0 faille.

Versions : vitest 5.1.0, vite 8.3.8, @vitejs/plugin-react 6.3.0. Le lockfile n'a bougé que pour cette chaîne
(entrées vite/vitest/esbuild/rollup/babel retirées puis résolues à nouveau) : aucune autre dépendance n'a changé de version.

Guides lus : Vitest [3.0](https://v3.vitest.dev/guide/migration), [4.0](https://v4.vitest.dev/guide/migration),
[5.0](https://vitest.dev/guide/migration) ; Vite [6](https://v6.vite.dev/guide/migration), [7](https://v7.vite.dev/guide/migration),
[8](https://vite.dev/guide/migration) ; CHANGELOG de @vitejs/plugin-react (5.0.0, 6.0.0).

## Changements cassants qui nous touchent, et leur correction

| Changement | Effet chez nous | Correction |
|---|---|---|
| Vitest 5 exige Node ≥ 22.12 ; Vite 8 et plugin-react 6 exigent Node ≥ 20.19 | La CI frontend (`frontend-checks.yml`, job `nginx-cache` de `build.yml`) et l'étage de build du Dockerfile tournaient en Node 20 | `node-version: 22` dans les deux workflows, `FROM node:22-alpine AS builder` dans `frontend/Dockerfile`. Le backend reste en Node 20 (hors lot). |
| `npm install` refuse la montée (ERESOLVE) tant que le lockfile garde l'arbre de Vite 5 (esbuild 0.21 ne satisfait pas le pair optionnel `esbuild ^0.27 \|\| ^0.28` de Vite 8) | Installation impossible sans `--force` | Retrait des entrées de la chaîne Vite/Vitest du lockfile, puis `npm install` : seule cette chaîne est résolue à nouveau |
| Vite 8 avertit que `__dirname` ne sera pas pris en charge par le futur chargeur de config natif (`configLoader: 'native'`) | Avertissement à chaque build | `import.meta.dirname` dans `vite.config.ts`, `vitest.config.ts`, `vitest.acceptation.config.ts` |

## Changements cassants vérifiés sans effet

- Vitest 3 : options d'un test en 3e argument (aucune), `mockReset` qui restaure l'original, faux minuteurs qui simulent aussi `performance.now()`, égalité d'erreurs plus stricte → suite verte sans retouche.
- Vitest 4 : pools réécrits sans tinypool (`poolOptions` absent de nos configs), `workspace` → `projects` (non utilisé), mocks de constructeurs, reporter `basic` retiré (non utilisé).
- Vitest 5 : `clearMocks` actif par défaut, `vi.mock`/`vi.hoisted` obligatoirement au niveau du module (sinon erreur), assertions asynchrones non attendues en échec, `toThrow('')`, titres de `test.each` formatés par pretty-format → 165 fichiers, 1349 tests verts, même nombre qu'avant.
- Vite 6 : `resolve.conditions`, postcss-load-config 6 (`postcss.config.js` inchangé), Sass (non utilisé).
- Vite 7 : cible navigateur par défaut « baseline-widely-available », Sass legacy retiré (non utilisé).
- Vite 8 : Rolldown + Oxc remplacent esbuild/Rollup, minification CSS par Lightning CSS, interop CommonJS uniformisée (leaflet, recharts : rendu vérifié dans le build de prod), cible Chrome 111 / Safari 16.4 / Firefox 114 ; aucune option `esbuild`, `rollupOptions` ou `manualChunks` dans nos configs.
- plugin-react 5/6 : Babel retiré (aucune option `babel` chez nous), React Refresh par Oxc, `react`/`react-dom` plus ajoutés à `resolve.dedupe` (une seule copie de React dans l'arbre).

## Vérifié

- `npm audit` : 6 failles avant, 0 après.
- `npx vitest run` : 165 fichiers / 1349 tests verts + 1 sauté (`skipIf` sans `dist/`) avant et après ; `TZ=UTC` : 1350 verts.
- Config d'acceptation chargée et verte (`CADENCE_ACCEPTATION=…/acceptation-L85.json`, 15 tests).
- `npm run build` sans avertissement ; `scripts/test-nginx-cache.sh` conforme.
- `docker build frontend` (node:22-alpine) : `npm ci` sans EBADENGINE, bindings musl de Rolldown et Lightning CSS présents, build vert.
- `npm run test:navigateur` (Chromium) : 128/128 sur quatre passes, dont une cache `node_modules/.vite` vidé. Deux passes
  précédentes, lancées sous une charge machine de 31 à 35 (autres sessions), avaient expiré au premier test de chaque fichier
  (délai de 30 s) ; non reproduit ensuite, ni avec 12 serveurs Vite simultanés (5,5 à 7 s par chargement).
- App lancée en local (dev et `vite preview` du build) : accueil, calendrier, classement, carte à 1440 et 390 px, console vide.
