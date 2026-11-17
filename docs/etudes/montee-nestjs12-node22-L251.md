# Montée @nestjs/cli, schematics, config, schedule 11 → 12 et image backend Node 20 → 22 (L251, L253, 2026-11-17)

But : fermer les 19 failles modérées du backend (`npm audit`) et quitter Node 20 (fin de vie) pour l'image Docker.
Après : `npm audit` → 0 faille ; image `node:22-alpine` (Node 22.23.5).

Versions : @nestjs/cli 12.0.13, @nestjs/schematics 12.0.13, @nestjs/config 12.1.1, @nestjs/schedule 12.0.4,
TypeScript 6.0.3 (imposé par la CLI et les schematics 12). @nestjs/core, common, platform-express et testing restent
en 11.2.10 (étiquette npm `legacy`, maintenue) : config 12 et schedule 12 acceptent `@nestjs/common ^11 || ^12`.

Guides lus : [guide de migration NestJS 12](https://docs.nestjs.com/migration-guide),
[`nest upgrade`](https://docs.nestjs.com/cli/usages), [notes de TypeScript 6](https://aka.ms/ts6).

## D'où venaient les 19 failles

Deux avis, tous deux sur des outils de développement (rien dans l'image de production) :

- [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) — glob 9.0.0 à 14.0.1 ;
- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) — minimatch 7.0.0 à 11.0.0.

Ils arrivent par **deux chemins** : @nestjs/cli 11 (glob 10 / minimatch 9), et **Jest 30.5** (`@jest/reporters`,
`jest-config`, `jest-runtime` → glob 13 ; `babel-plugin-istanbul` → `test-exclude` 7 → glob 10, minimatch 9/10).
Monter la CLI en 12 ne ferme que le premier chemin (19 → 18). `npm audit fix --force` propose de **rétrograder Jest en
29.7** : refusé. Le second chemin se ferme par des `overrides` npm dans `package.json` :

```json
"overrides": { "glob": "^14.0.6", "test-exclude": { "minimatch": "^11.0.5" } }
```

glob 14 garde une entrée CommonJS (`exports.require`) et la même API `glob`/`globSync` ; `test-exclude` 7 appelle
`require('minimatch').minimatch`, présent en 11. Vérifié par une passe `jest --coverage` (seul usage de `test-exclude`).
Ne pas forcer `minimatch` partout : ESLint 9 en dépend en 3.1 (hors plage vulnérable, API différente).

## Changements cassants qui nous touchent, et leur correction

| Changement | Symptôme | Correction |
|---|---|---|
| @nestjs/schematics 12 exige TypeScript ≥ 6 en pair | `npm i` refuse (ERESOLVE) avec TypeScript 5 | `typescript@^6` en même temps que la CLI |
| TS 6 : `rootDir` doit être explicite quand la sortie en dépend (TS5011) | 49 suites Jest en échec « The common source directory … The 'rootDir' setting must be explicitly set » | `"rootDir": "./"` dans `tsconfig.json` (tests), `"rootDir": "./src"` dans `tsconfig.build.json` (le build reste `dist/main.js`) |
| TS 6 : `baseUrl` déprécié (TS5101, erreur sans `ignoreDeprecations`) | Même échec | `baseUrl` retiré (aucun `paths` ni import depuis `src/…`) |
| TS 6 : `types` vaut `[]` par défaut (plus d'inclusion automatique des `@types/*`) | `describe`, `jest`, `process`… inconnus à la compilation | `"types": ["node", "jest"]` (tests), `["node"]` (build) |
| Les paquets Nest 12 sont **ESM uniquement** (`"type": "module"`) ; Node les charge depuis du CommonJS (`require(esm)`, Node ≥ 20.19 / ≥ 22.12), **Jest seulement à partir de Node 24.9** | Sous Node 22 : « Must use import to load ES Module: …/@nestjs/schedule/dist/index.js » (28 suites sur 49) | Jest transforme ces deux paquets en CommonJS : `transformIgnorePatterns: ["/node_modules/(?!@nestjs/(schedule\|config)/)"]` et une transformation `babel-jest` avec le seul greffon `@babel/plugin-transform-modules-commonjs` (v7, celle de `@babel/core` 7 que tire Jest 30 ; la v8 refuse l'installation). Même réglage dans `test/jest-e2e.json`. À étendre si un autre paquet ESM-only arrive (core, common… en 12) |
| `exports` des paquets ESM : plus d'import profond vers `dist/` | e2e : « Cannot find module '@nestjs/schedule/dist/scheduler.orchestrator' » (classe non exportée par l'index, remplacée par un orchestrateur inerte dans le test) | Chargement par chemin absolu, à côté de l'index résolu : `require(path.join(path.dirname(require.resolve('@nestjs/schedule')), 'scheduler.orchestrator.js'))` — même fichier que celui qu'importe `ScheduleModule`, donc même jeton d'injection |
| Chargement à froid plus lent (~+0,3 s par processus Jest : transformation des paquets ESM, @nestjs/config 12) | `jest --no-cache` (cache froid, comme un premier lancement) : 2 échecs dans un fichier dont le premier test attend déjà ~2,3 s de vraies relances sous le délai de 5 s ; le délai dépassé laisse une relance déborder sur le test suivant (4 appels au lieu de 3) | Préchargement du module dans un `beforeAll` (puis `resetModules`) : la transformation sort du délai du test, assertions inchangées. Rien changé aux délais |

Image Docker : `node:20-alpine` → `node:22-alpine` aux deux étages, sans autre changement ; `npm ci` sans EBADENGINE.

## Changements cassants vérifiés sans effet

- **@nestjs/config 12** : réglages propres à la bibliothèque de validation déplacés sous `validationOptions.libraryOptions`
  et Joi ≥ 18 (Standard Schema) — nous n'avons ni `validationSchema` ni `validationOptions` (`forRoot({ load, isGlobal })`).
  `ConfigService.get` rend les mêmes valeurs (vérifié sur un contexte d'application démarré).
- **@nestjs/schedule 12** (cron 3.5 → 4.4) : les 8 tâches `@Cron` (fuseau `Europe/Paris`) sont enregistrées avant
  comme après, et `CronTime.sendAt()` donne la même prochaine date pour chaque expression, dont `0 0 3 1 8 *`
  (1er août 03:00, mois toujours numérotés 1–12).
- **CLI 12** : options `webpack`/`webpackConfigPath` dépréciées au profit de `--builder rspack` — non utilisées
  (`nest-cli.json` sans webpack) ; `nest build` (tsc) inchangé.
- **Ordre des hooks de cycle de vie par niveau de hiérarchie**, signatures de pipes, journalisation structurée,
  Vitest par défaut : changements de `@nestjs/core`/`common` 12, **non montés** dans ce lot.

## Ce qui reste pour passer core/common en 12

Ces paquets sont aussi ESM-only : la transformation Jest ci-dessus devra les inclure (ou les tests passer en
Node ≥ 24.9, ou en Vitest, recommandé par le guide). L'avertissement existant `LegacyRouteConverter` (« Unsupported
route path: "/api/*" », Express 5) est antérieur à ce lot.

## Vérifié

- `npm audit` : 19 modérées avant, 0 après.
- `jest` : 49 suites / 538 tests verts avant et après (même nombre) ; trois passes `--no-cache` vertes ;
  `--coverage` à froid verte. e2e hermétique (`npm run test:e2e`) : 5/5 avant et après, dont « ne monte aucune tâche planifiée ».
- `nest build` vert, `tsc -p tsconfig.build.json` sans erreur ; `tsc -p tsconfig.json` : la même erreur préexistante
  (spec `team-stats`) avant et après. ESLint : pas d'erreur nouvelle (1435 problèmes avant, 1432 après).
- `docker build backend` (node:22-alpine) puis conteneur démarré : `/api/health` → `{"status":"ok"}`, Node 22.23.5.
- App en local (backend construit + frontend Vite) : accueil, calendrier, classement affichés avec les données
  365scores, console sans erreur.
