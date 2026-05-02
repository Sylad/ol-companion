# OL Companion — News fix, Cup brackets, Scheduler & Season reset

**Date** : 2026-05-02
**Auteur** : Sylvain (avec Claude Code)
**Statut** : design validé, prêt pour implémentation

## Contexte

Trois chantiers complémentaires sur l'app `ol-companion` :

1. **Bug news** : la `description` des articles Google News s'affiche avec du HTML brut (`<a href=...>...</a>`) visible à l'utilisateur.
2. **Bracket coupe** : à partir d'un certain stade éliminatoire, afficher un schéma de tableau de la compétition avant la liste des matchs OL.
3. **Scheduler centralisé + reset saison** : remplacer les `setInterval` ad hoc par `@nestjs/schedule`, étendre la couverture à tous les services data, et automatiser un reset annuel des données au 1er août.

Les trois sujets partagent une infra commune (notion de saison courante, cache JSON par service) et seront livrés ensemble.

## Architecture

```
backend/src/modules/
├── news/                       (modifié : fix description)
├── cups/
│   ├── cups.service.ts         (modifié : ajout bracket dans CupInfo)
│   ├── cups.controller.ts
│   ├── bracket.service.ts      (NOUVEAU : matchs des autres équipes)
│   └── cups.module.ts
├── scheduler/                  (NOUVEAU MODULE)
│   ├── scheduler.module.ts
│   ├── season.util.ts
│   ├── season-reset.service.ts
│   └── admin.controller.ts
├── fixtures/                   (modifié : @Cron au lieu de setInterval)
├── standings/                  (modifié : @Cron au lieu de setInterval)
├── lineup/                     (modifié : ajout @Cron)
├── players/                    (modifié : ajout @Cron)
├── events/                     (modifié : ajout @Cron)
└── app.module.ts               (modifié : import ScheduleModule.forRoot() + SchedulerModule)

frontend/src/
├── components/
│   ├── bracket.tsx             (NOUVEAU)
│   └── bracket-match.tsx       (NOUVEAU)
├── routes/cups.tsx             (modifié : intègre <Bracket>)
└── types/api.ts                (modifié : BracketInfo, BracketMatch, BracketStage)
```

**Dépendances ajoutées** (backend) :

- `@nestjs/schedule` (déclaratif `@Cron`, gère le démarrage/arrêt avec le module).

## Feature 1 — Fix news description

### Cause

`news.service.ts:parseRss` strip les balises HTML *avant* de décoder les entités. Or Google News encode son HTML deux fois (`<a href=...>` → `&lt;a href=...&gt;`). Résultat : le strip ne voit aucune balise, puis `decode()` ressort les `<a>` qui s'affichent tels quels dans la card React.

### Fix

Patch ciblé dans `parseRss` :

```ts
const rawDescription = this.extractTag(block, 'description');
// Décoder d'abord les entités HTML (Google News double-encode <a> en &lt;a&gt;),
// stripper les balises, puis re-décoder pour les entités résiduelles.
const description = this.decode(
  this.decode(rawDescription).replace(/<[^>]+>/g, '')
).trim().slice(0, 240);
```

### Tests

`news.service.spec.ts` (nouveau) — 3 fixtures :

- RSS Olympique-et-Lyonnais (description en clair) → identité.
- RSS L'Équipe (description avec `<![CDATA[<p>...</p>]]>`) → strip ok.
- RSS Google News (description double-encodée `&lt;a href=...&gt;texte&lt;/a&gt;`) → texte uniquement.

## Feature 2 — Bracket de coupe

### Modèle

Étend `CupInfo` :

```ts
interface BracketMatch {
  id: number;
  homeTeam: string; homeTeamId: number; homeLogo?: string;
  awayTeam: string; awayTeamId: number; awayLogo?: string;
  homeScore: number | null; awayScore: number | null;
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  stageNum: number;
  hasOL: boolean;
  date: string;
}

interface BracketStage {
  stageNum: number;
  stageFr: string;
  matches: BracketMatch[];
}

interface BracketInfo {
  competitionId: number;
  fromStageNum: number;
  stages: BracketStage[];
}

interface CupInfo {
  competitionId: number;
  name: string;
  currentStageFr: string;
  isEliminated: boolean;
  matches: CupMatch[];
  bracket?: BracketInfo;  // présent si seuil atteint
}
```

### Seuils

- **Coupe de France** (id 37) : bracket affiché à partir de `stageNum >= 6` (1/4 de finale).
- **Europa League** (id 573) : bracket affiché à partir de `stageNum >= 3` (1/8 de finale, post-barrages).

Le bracket continue d'être affiché même si l'OL est éliminé, jusqu'à la fin de la compétition.

### Backend — `bracket.service.ts`

Nouveau service injecté dans `CupsService` (même module).

API privée :

```ts
async fetchBracket(competitionId: number, fromStageNum: number, seasonStart: Date): Promise<BracketInfo | null>
```

**Source** : 365scores `https://data.365scores.com/web/games/?appTypeId=5&langId=1&timezoneName=Europe/Paris&competitions=<id>&limit=200` (mêmes headers que `cups.service.ts`).

**Logique** :

1. Fetch tous les matchs de la compétition (résultats + à venir) pour la saison courante.
2. Filtrer `stageNum >= fromStageNum`.
3. Grouper par `stageNum`, mapper chaque match en `BracketMatch` (incl. `hasOL = (homeId === 465 || awayId === 465)`).
4. Si aucun match au seuil → retourner `null` (le frontend ne rend rien).

**Trigger** : `CupsService.fetchCupsFrom365Scores()` détermine le `currentStageNum` de l'OL pour chaque cup. Si ≥ seuil, appelle `bracketService.fetchBracket()` et stocke le résultat dans `CupInfo.bracket`.

**Cache** : porté par le cache `cups-cache.json` existant (TTL 2h).

### Frontend — `<Bracket>` et `<BracketMatch>`

Composant `bracket.tsx` placé **au-dessus** de `<CupMatchRow>` dans `cups.tsx:CupCard`.

**Layout responsive** :

- Desktop ≥ md : colonnes flex horizontales, une colonne par stage (largeur min 200px), gap 8 → 24 selon le viewport. Cards `BracketMatch` empilées par paire avec connecteurs CSS (border-l + border-b sur pseudo-éléments) pour suggérer l'arbre.
- Mobile : stack vertical, un en-tête de section par stage (libellé `BracketStage.stageFr`, ex. `Quart de finale`), 1 card par match. Les stages présents sont dérivés de `bracket.stages[]` — pas de liste figée.

**`BracketMatch` card** :

- 2 lignes (home / away) avec nom + score (ou date si `SCHEDULED`).
- Si `hasOL` : border `ol-red`, fond `ol-red/10`, texte gras sur la ligne OL.
- Si match `FINISHED` : score affiché à droite, ligne du gagnant en `text-fg-bright`, perdant en `text-fg-dim`.

### Tests

`bracket.service.spec.ts` — fixtures 365scores mockées :

- CdF avec OL en 1/4 → bracket avec stages 6, 7, 8.
- EL avec OL en 1/8 → bracket avec stages 3, 4, 5, 6.
- Cup sans OL en stage cible → bracket retourné quand même (continuation après élimination).
- Cup où OL n'a pas atteint le seuil → `null`.

## Feature 3 — Scheduler centralisé + reset saison

### 3.1 Migration vers `@nestjs/schedule`

`AppModule` importe `ScheduleModule.forRoot()`. Chaque service refresh utilise `@Cron(expr, { name, timeZone: 'Europe/Paris' })`.

**Cadences cibles** :

| Service | Cron | Fréquence | Notes |
|---|---|---|---|
| standings | `0 0 * * * *` | toutes les heures | migration depuis setInterval |
| fixtures | `0 */30 * * * *` | toutes les 30 min | migration depuis setInterval |
| cups (+ bracket) | `0 0 */2 * * *` | toutes les 2h | nouveau |
| news | `0 */30 * * * *` | toutes les 30 min | nouveau |
| lineup | `0 */15 * * * *` | toutes les 15 min | nouveau |

Les modules `events` (event-bus uniquement) et `players` (pas de service backend) n'ont pas de refresh data → pas de `@Cron`.

**Migration `setInterval` → `@Cron`** :

- `fixtures.service.ts` : supprimer `refreshTimer`, remplacer par `@Cron`. Conserver `onModuleInit` qui déclenche un premier refresh au boot.
- `standings.service.ts` : idem. `onModuleInit` continue d'appeler `ensureHistoryFile()`.

### 3.2 Helper saison — `season.util.ts`

```ts
export interface Season {
  id: string;          // ex. "2025-2026"
  startDate: Date;     // 1er août du startYear, 00:00 Europe/Paris
  endDate: Date;       // 31 juillet 23:59:59 du startYear+1
}

export function getCurrentSeason(d: Date = new Date()): Season {
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const startYear = month >= 8 ? year : year - 1;
  return {
    id: `${startYear}-${startYear + 1}`,
    startDate: new Date(`${startYear}-08-01T00:00:00`),
    endDate: new Date(`${startYear + 1}-07-31T23:59:59`),
  };
}

export function getPreviousSeason(d: Date = new Date()): Season {
  const current = getCurrentSeason(d);
  const prevStart = new Date(current.startDate);
  prevStart.setFullYear(prevStart.getFullYear() - 1);
  return getCurrentSeason(prevStart);
}
```

`cups.service.ts` :  `seasonStart = getCurrentSeason().startDate` (au lieu de `new Date('2025-08-01')` en dur).

### 3.3 `SeasonResetService`

```ts
@Injectable()
export class SeasonResetService {
  @Cron('0 0 3 1 8 *', { timeZone: 'Europe/Paris', name: 'season-reset' })
  async resetSeason() {
    const season = getPreviousSeason();
    // Déplace data/*-cache.json + data/standings-history.json + data/season-rankings.json
    // → data/archive/<season>/. Les @Cron des autres services regénèrent au prochain tick.
    return this.archiveAndClear(season);
  }
}
```

**Caches archivés** (déplacés, pas copiés) :

- `data/cups-cache.json`
- `data/fixtures-cache.json`
- `data/standings-cache.json`
- `data/news-cache.json`
- `data/players-cache.json`
- `data/events-cache.json`
- `data/lineup-cache.json`
- `data/standings-history.json`

**Destination** : `data/archive/2024-2025/<filename>.json`. Si un fichier source n'existe pas, on l'ignore silencieusement.

### 3.4 Endpoint admin

`PinGuard` n'existe pas encore dans `ol-companion` : on le porte depuis `warhammer40k` (`backend/src/auth/pin.guard.ts`) ou `finance-tracker-v2`. Pattern : lit `APP_PIN` env var, attend un header `Authorization: Bearer <pin>`. Si `APP_PIN` est absent, le guard laisse passer (mode permissif), conforme à `pin_auth_pattern.md`.

Variable d'env optionnelle ajoutée à `ol-companion/.env` : `APP_PIN=<pin>` (laissée vide pour conserver le comportement actuel).

```ts
@Controller('admin')
export class AdminController {
  constructor(private readonly seasonReset: SeasonResetService) {}

  @Post('reset-season')
  @UseGuards(PinGuard)
  async manualReset() {
    return this.seasonReset.resetSeason();
  }
}
```

### Tests

- `season.util.spec.ts` : 31 juillet 23:59 → saison 2024-2025 ; 1er août 00:00 → saison 2025-2026 ; getPreviousSeason cohérent.
- `season-reset.service.spec.ts` : archivage déplace les fichiers présents et ignore les absents ; clearCaches supprime les caches courants ; émet `season:reset`.

## Validation manuelle

1. **News fix** : ouvrir `http://nas:4202/news` après rebuild backend, vérifier que les cards Google News n'affichent plus de `<a href=…>` brut. Sur les autres sources, descriptions inchangées.
2. **Bracket** : forcer un cache `cups-cache.json` (ou attendre le cron) avec OL en 1/4 CdF. Vérifier que le bracket apparaît au-dessus de la liste des matchs, et que la card du match OL est highlightée en rouge. Tester aussi l'EL en 1/8.
3. **Scheduler** : observer les logs backend après boot — chaque `@Cron` doit logger sa première exécution selon la cadence (et non plus toutes les `REFRESH_INTERVAL_MS`).
4. **Reset manuel** : `curl -X POST http://nas:3002/api/admin/reset-season -H "Authorization: Bearer <PIN>"` → vérifier `data/archive/2024-2025/` créé, caches courants vidés, refresh auto déclenché par les crons suivants.

## Build & deploy

Recette CLAUDE.md :

```bash
docker compose -f /volume2/docker/developpeur/ol-companion/docker-compose.yml up -d --build ol-backend ol-frontend
```

Vérifier les TS errors silencieuses (cf. `docker_silent_ts_errors.md`) avec un `grep "error TS"` dans la sortie de build avant de considérer le déploiement OK.

## Hors scope

- Refonte complète du parser RSS (option B écartée).
- Sources de données alternatives pour le bracket (UEFA.com, FFF.fr) — envisageable plus tard si 365scores se révèle insuffisant.
- Frontend bracket sur la page d'accueil ou les pages joueurs.
- Notifications push lors d'un reset de saison.
