# OL Companion — News fix, Cup brackets, Scheduler & Season reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer trois chantiers OL Companion : fix Google News description, bracket de coupe à partir des 1/4 (CdF) et 1/8 (EL), et migration des refresh `setInterval` vers `@nestjs/schedule` avec reset annuel automatique au 1er août.

**Architecture:** Backend NestJS étendu avec `@nestjs/schedule`, nouveau module `scheduler` (helpers saison + reset service + admin controller), nouveau service `BracketService` côté `cups`. Frontend React reçoit un champ optionnel `bracket` dans `CupInfo` et le rend via deux nouveaux composants (`Bracket`, `BracketMatch`).

**Tech Stack:** NestJS 11, `@nestjs/schedule`, TypeScript strict, Jest, React 18, Tailwind, classes utilitaires existantes.

---

## Phase 0 — Preflight

### Task 0.1: Installer `@nestjs/schedule`

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install dependency**

```bash
cd backend && npm install @nestjs/schedule@^4.1.0
```

- [ ] **Step 2: Verify install**

Run: `cd backend && grep -A1 '"@nestjs/schedule"' package.json`
Expected: `"@nestjs/schedule": "^4.1.0"` line present.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(ol-companion): add @nestjs/schedule dependency"
```

---

## Phase 1 — Fix news description (Feature 1)

### Task 1.1: Tests pour la fonction de décodage description

**Files:**
- Create: `backend/src/modules/news/news.service.spec.ts`
- Reference: `backend/src/modules/news/news.service.ts:73-86`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/news/news.service.spec.ts`:

```ts
import { NewsService } from './news.service';

describe('NewsService.parseRss (description decoding)', () => {
  let service: NewsService;
  beforeEach(() => { service = new NewsService(); });

  // Use bracket access to call private method in tests.
  const parseRss = (xml: string) => (service as any).parseRss(xml, 'TestSource');

  it('keeps clean text descriptions intact', () => {
    const xml = `<rss><channel><item>
      <title>Article 1</title>
      <link>https://x/1</link>
      <pubDate>Thu, 01 May 2026 10:00:00 GMT</pubDate>
      <description>Texte simple sans HTML.</description>
    </item></channel></rss>`;
    const items = parseRss(xml);
    expect(items[0].description).toBe('Texte simple sans HTML.');
  });

  it('strips raw HTML from description (L\'Equipe / standard RSS)', () => {
    const xml = `<rss><channel><item>
      <title>Article 2</title>
      <link>https://x/2</link>
      <pubDate>Thu, 01 May 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Lyon <strong>gagne</strong> face à Marseille</p>]]></description>
    </item></channel></rss>`;
    const items = parseRss(xml);
    expect(items[0].description).toBe('Lyon gagne face à Marseille');
  });

  it('strips double-encoded HTML from Google News description', () => {
    const xml = `<rss><channel><item>
      <title>Article 3</title>
      <link>https://x/3</link>
      <pubDate>Thu, 01 May 2026 10:00:00 GMT</pubDate>
      <description>&lt;a href=&quot;https://news.google.com/x&quot;&gt;OL : Fonseca avant le derby&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font&gt;Le Progres&lt;/font&gt;</description>
    </item></channel></rss>`;
    const items = parseRss(xml);
    // No remaining <a> or <font> markup; entities fully decoded.
    expect(items[0].description).not.toMatch(/<\/?[a-z]+/i);
    expect(items[0].description).not.toMatch(/&lt;|&gt;|&quot;|&amp;/);
    expect(items[0].description).toContain('OL : Fonseca avant le derby');
    expect(items[0].description).toContain('Le Progres');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest src/modules/news/news.service.spec.ts
```

Expected: at least the third test fails — current parser leaves `<a href=...>` markup in description.

- [ ] **Step 3: Apply the fix**

Edit `backend/src/modules/news/news.service.ts` lines 79-83 from:

```ts
const rawDescription = this.extractTag(block, 'description');
const description = this.decode(rawDescription.replace(/<[^>]+>/g, '').trim().slice(0, 240));
```

To:

```ts
const rawDescription = this.extractTag(block, 'description');
// Google News double-encodes HTML (&lt;a&gt;...). Decode first, strip tags,
// decode again to flatten any residual entities, then trim and clip.
const description = this.decode(
  this.decode(rawDescription).replace(/<[^>]+>/g, ''),
).trim().slice(0, 240);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest src/modules/news/news.service.spec.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/news/news.service.ts backend/src/modules/news/news.service.spec.ts
git commit -m "fix(ol-companion/news): decode Google News HTML before strip"
```

---

## Phase 2 — Helper saison (Feature 3 prep)

### Task 2.1: Tests pour `getCurrentSeason` / `getPreviousSeason`

**Files:**
- Create: `backend/src/modules/scheduler/season.util.ts`
- Create: `backend/src/modules/scheduler/season.util.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/scheduler/season.util.spec.ts`:

```ts
import { getCurrentSeason, getPreviousSeason } from './season.util';

describe('season.util', () => {
  describe('getCurrentSeason', () => {
    it('returns 2025-2026 for 1 August 2025 00:00', () => {
      const s = getCurrentSeason(new Date('2025-08-01T00:00:00'));
      expect(s.id).toBe('2025-2026');
      expect(s.startDate.toISOString().slice(0, 10)).toBe('2025-08-01');
    });

    it('returns 2024-2025 for 31 July 2025 23:59', () => {
      const s = getCurrentSeason(new Date('2025-07-31T23:59:59'));
      expect(s.id).toBe('2024-2025');
    });

    it('returns 2025-2026 for any date in May 2026', () => {
      const s = getCurrentSeason(new Date('2026-05-02T12:00:00'));
      expect(s.id).toBe('2025-2026');
    });
  });

  describe('getPreviousSeason', () => {
    it('returns 2024-2025 when called on 1 August 2025', () => {
      const s = getPreviousSeason(new Date('2025-08-01T00:00:01'));
      expect(s.id).toBe('2024-2025');
    });

    it('returns 2024-2025 when called in May 2026', () => {
      const s = getPreviousSeason(new Date('2026-05-02T12:00:00'));
      expect(s.id).toBe('2024-2025');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest src/modules/scheduler/season.util.spec.ts
```

Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement helper**

Create `backend/src/modules/scheduler/season.util.ts`:

```ts
export interface Season {
  id: string;          // ex. "2025-2026"
  startDate: Date;     // 1er août du startYear, 00:00 (heure locale)
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
  const prevAnchor = new Date(current.startDate);
  prevAnchor.setFullYear(prevAnchor.getFullYear() - 1);
  return getCurrentSeason(prevAnchor);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest src/modules/scheduler/season.util.spec.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/scheduler/season.util.ts backend/src/modules/scheduler/season.util.spec.ts
git commit -m "feat(ol-companion/scheduler): add season utility (current/previous)"
```

### Task 2.2: Remplacer la date saison en dur dans `cups.service.ts`

**Files:**
- Modify: `backend/src/modules/cups/cups.service.ts`

- [ ] **Step 1: Edit `cups.service.ts`**

Replace, inside `fetchCupsFrom365Scores()`:

```ts
const seasonStart = new Date('2025-08-01').getTime();
```

with:

```ts
import { getCurrentSeason } from '../scheduler/season.util';
// ... at top of file
const seasonStart = getCurrentSeason().startDate.getTime();
```

(Add the `import` line at the top with the other imports; remove the inline `new Date('2025-08-01')`.)

- [ ] **Step 2: Run tests to ensure nothing else breaks**

```bash
cd backend && npx jest --passWithNoTests
```

Expected: green (no test references the previous literal).

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/cups/cups.service.ts
git commit -m "refactor(ol-companion/cups): derive season start from getCurrentSeason"
```

---

## Phase 3 — Bracket types & service (Feature 2 backend)

### Task 3.1: Définir les types `BracketMatch`, `BracketStage`, `BracketInfo`

**Files:**
- Modify: `backend/src/modules/cups/cups.service.ts` (export types)
- Modify: `frontend/src/types/api.ts` (mirror types)

- [ ] **Step 1: Add types to backend `cups.service.ts`**

Append (or co-locate with existing exports) in `backend/src/modules/cups/cups.service.ts`:

```ts
export interface BracketMatch {
  id: number;
  date: string;
  homeTeam: string; homeTeamId: number; homeLogo?: string;
  awayTeam: string; awayTeamId: number; awayLogo?: string;
  homeScore: number | null; awayScore: number | null;
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  stageNum: number;
  stageFr: string;
  hasOL: boolean;
}

export interface BracketStage {
  stageNum: number;
  stageFr: string;
  matches: BracketMatch[];
}

export interface BracketInfo {
  competitionId: number;
  fromStageNum: number;
  stages: BracketStage[];
}
```

And extend `CupInfo`:

```ts
export interface CupInfo {
  competitionId: number;
  name: string;
  currentStageFr: string;
  isEliminated: boolean;
  matches: CupMatch[];
  bracket?: BracketInfo;
}
```

- [ ] **Step 2: Mirror types in frontend `frontend/src/types/api.ts`**

After the existing `CupInfo` block, add:

```ts
export interface BracketMatch {
  id: number;
  date: string;
  homeTeam: string; homeTeamId: number; homeLogo?: string;
  awayTeam: string; awayTeamId: number; awayLogo?: string;
  homeScore: number | null; awayScore: number | null;
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  stageNum: number;
  stageFr: string;
  hasOL: boolean;
}

export interface BracketStage {
  stageNum: number;
  stageFr: string;
  matches: BracketMatch[];
}

export interface BracketInfo {
  competitionId: number;
  fromStageNum: number;
  stages: BracketStage[];
}
```

And extend the existing `CupInfo`:

```ts
export interface CupInfo {
  competitionId: number;
  name: string;
  currentStageFr: string;
  isEliminated: boolean;
  matches: CupMatch[];
  bracket?: BracketInfo;
}
```

- [ ] **Step 3: Type check**

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

Expected: no errors (the new fields are optional).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/cups/cups.service.ts frontend/src/types/api.ts
git commit -m "feat(ol-companion/cups): add BracketInfo types"
```

### Task 3.2: Tests pour `BracketService`

**Files:**
- Create: `backend/src/modules/cups/bracket.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/cups/bracket.service.spec.ts`:

```ts
import { BracketService } from './bracket.service';

const sample365 = (overrides: Partial<any> = {}) => ({
  id: 1,
  startTime: '2026-04-15T19:00:00Z',
  statusGroup: 4,
  stageNum: 6,
  homeCompetitor: { id: 100, name: 'Lille', score: 0 },
  awayCompetitor: { id: 465, name: 'Lyon', score: 2 },
  ...overrides,
});

describe('BracketService.fetchBracket', () => {
  let service: BracketService;
  beforeEach(() => { service = new BracketService(); });

  function withFetch(games: any[]) {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ games }),
    });
  }

  it('returns null when no match meets the stage threshold', async () => {
    withFetch([sample365({ stageNum: 4 })]); // round of 16, below CdF threshold 6
    const result = await service.fetchBracket(37, 6, new Date('2025-08-01'));
    expect(result).toBeNull();
  });

  it('groups CdF matches from quarter-finals onward into stages', async () => {
    withFetch([
      sample365({ id: 1, stageNum: 6 }),
      sample365({ id: 2, stageNum: 6, homeCompetitor: { id: 200, name: 'PSG' }, awayCompetitor: { id: 300, name: 'Nice' } }),
      sample365({ id: 3, stageNum: 7 }),
      sample365({ id: 4, stageNum: 8 }),
    ]);
    const r = await service.fetchBracket(37, 6, new Date('2025-08-01'));
    expect(r).not.toBeNull();
    expect(r!.fromStageNum).toBe(6);
    expect(r!.stages.map((s) => s.stageNum)).toEqual([6, 7, 8]);
    expect(r!.stages[0].matches).toHaveLength(2);
    expect(r!.stages[0].matches[0].hasOL).toBe(true);
    expect(r!.stages[0].matches[1].hasOL).toBe(false);
  });

  it('continues to expose bracket after OL is eliminated', async () => {
    // OL lost in quarters; semis/final do not include OL
    withFetch([
      sample365({ id: 1, stageNum: 6, homeCompetitor: { id: 100, name: 'Lille', score: 1 }, awayCompetitor: { id: 465, name: 'Lyon', score: 0 } }),
      sample365({ id: 2, stageNum: 7, homeCompetitor: { id: 100, name: 'Lille' }, awayCompetitor: { id: 200, name: 'PSG' } }),
    ]);
    const r = await service.fetchBracket(37, 6, new Date('2025-08-01'));
    expect(r).not.toBeNull();
    expect(r!.stages.map((s) => s.stageNum)).toEqual([6, 7]);
    expect(r!.stages[1].matches[0].hasOL).toBe(false);
  });

  it('filters out matches before season start', async () => {
    withFetch([
      sample365({ id: 1, stageNum: 6, startTime: '2025-04-15T19:00:00Z' }), // previous season
      sample365({ id: 2, stageNum: 6, startTime: '2026-04-15T19:00:00Z' }), // current season
    ]);
    const r = await service.fetchBracket(37, 6, new Date('2025-08-01'));
    expect(r!.stages[0].matches).toHaveLength(1);
    expect(r!.stages[0].matches[0].id).toBe(2);
  });

  it('labels EL stages from round of 16 (stageNum 3) onward', async () => {
    withFetch([
      sample365({ stageNum: 3 }),
      sample365({ stageNum: 4 }),
      sample365({ stageNum: 5 }),
      sample365({ stageNum: 6 }),
    ]);
    const r = await service.fetchBracket(573, 3, new Date('2025-08-01'));
    expect(r!.stages.map((s) => s.stageFr)).toEqual([
      '1/8 de finale',
      '1/4 de finale',
      'Demi-finale',
      'Finale',
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest src/modules/cups/bracket.service.spec.ts
```

Expected: FAIL — `BracketService` does not exist.

### Task 3.3: Implémenter `BracketService`

**Files:**
- Create: `backend/src/modules/cups/bracket.service.ts`

- [ ] **Step 1: Implement the service**

Create `backend/src/modules/cups/bracket.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { BracketInfo, BracketMatch, BracketStage } from './cups.service';

const OL_365SCORES_ID = 465;

const CDF_STAGES: Record<number, string> = {
  6: '1/4 de finale',
  7: 'Demi-finale',
  8: 'Finale',
};

const EL_STAGES: Record<number, string> = {
  3: '1/8 de finale',
  4: '1/4 de finale',
  5: 'Demi-finale',
  6: 'Finale',
};

const STAGE_NAMES: Record<number, Record<number, string>> = {
  37: CDF_STAGES,
  573: EL_STAGES,
};

const SCORES365_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'X-Domain': 'fr',
  'Referer': 'https://www.365scores.com/fr/football',
  'Origin': 'https://www.365scores.com',
};

@Injectable()
export class BracketService {
  private readonly logger = new Logger(BracketService.name);

  async fetchBracket(competitionId: number, fromStageNum: number, seasonStart: Date): Promise<BracketInfo | null> {
    const url = `https://data.365scores.com/web/games/?appTypeId=5&langId=1&timezoneName=Europe/Paris&competitions=${competitionId}&limit=200`;

    let games: any[] = [];
    try {
      const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        this.logger.warn(`Bracket fetch HTTP ${res.status} for comp ${competitionId}`);
        return null;
      }
      const d = await res.json() as any;
      games = d.games ?? [];
    } catch (err) {
      this.logger.warn(`Bracket fetch failed for comp ${competitionId}: ${(err as Error).message}`);
      return null;
    }

    const seasonStartMs = seasonStart.getTime();
    const stageNames = STAGE_NAMES[competitionId] ?? {};

    const eligible = games
      .filter((g) => (g.stageNum ?? 0) >= fromStageNum)
      .filter((g) => new Date(g.startTime).getTime() >= seasonStartMs);

    if (eligible.length === 0) return null;

    const byStage = new Map<number, BracketMatch[]>();
    for (const g of eligible) {
      const stageNum = g.stageNum;
      if (!byStage.has(stageNum)) byStage.set(stageNum, []);
      byStage.get(stageNum)!.push(this.toBracketMatch(g, stageNames));
    }

    const stages: BracketStage[] = Array.from(byStage.entries())
      .sort(([a], [b]) => a - b)
      .map(([stageNum, matches]) => ({
        stageNum,
        stageFr: stageNames[stageNum] ?? `Stage ${stageNum}`,
        matches: matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));

    return { competitionId, fromStageNum, stages };
  }

  private toBracketMatch(g: any, stageNames: Record<number, string>): BracketMatch {
    const status =
      g.statusGroup === 4 ? 'FINISHED'
      : g.statusGroup === 2 ? 'IN_PLAY'
      : 'SCHEDULED';
    const homeId = g.homeCompetitor?.id ?? 0;
    const awayId = g.awayCompetitor?.id ?? 0;
    const hasScore = status !== 'SCHEDULED';
    return {
      id: g.id,
      date: new Date(g.startTime).toISOString(),
      homeTeam: g.homeCompetitor?.name ?? '',
      homeTeamId: homeId,
      awayTeam: g.awayCompetitor?.name ?? '',
      awayTeamId: awayId,
      homeScore: hasScore ? (g.homeCompetitor?.score ?? null) : null,
      awayScore: hasScore ? (g.awayCompetitor?.score ?? null) : null,
      status,
      stageNum: g.stageNum,
      stageFr: stageNames[g.stageNum] ?? `Stage ${g.stageNum}`,
      hasOL: homeId === OL_365SCORES_ID || awayId === OL_365SCORES_ID,
    };
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd backend && npx jest src/modules/cups/bracket.service.spec.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 3: Register `BracketService` in `cups.module.ts`**

Edit `backend/src/modules/cups/cups.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CupsService } from './cups.service';
import { CupsController } from './cups.controller';
import { BracketService } from './bracket.service';

@Module({
  providers: [CupsService, BracketService],
  controllers: [CupsController],
})
export class CupsModule {}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/cups/bracket.service.ts backend/src/modules/cups/bracket.service.spec.ts backend/src/modules/cups/cups.module.ts
git commit -m "feat(ol-companion/cups): add BracketService for cup bracket data"
```

### Task 3.4: Câbler `BracketService` dans `CupsService`

**Files:**
- Modify: `backend/src/modules/cups/cups.service.ts`

- [ ] **Step 1: Inject `BracketService` and call it conditionally**

Edit the constructor in `backend/src/modules/cups/cups.service.ts`:

```ts
import { BracketService } from './bracket.service';

// ...
constructor(
  private config: ConfigService,
  private readonly bracketService: BracketService,
) {}
```

Add a constant near the existing `COMP_NAMES`/`COMP_STAGES`:

```ts
// stageNum threshold for displaying a bracket: CdF from quarters (6), EL from round of 16 (3)
const BRACKET_FROM_STAGE: Record<number, number> = {
  37: 6,
  573: 3,
};
```

In `fetchCupsFrom365Scores()`, after building `results: CupInfo[]` and before the final sort, add:

```ts
const seasonStart = getCurrentSeason().startDate;
for (const cup of results) {
  const fromStageNum = BRACKET_FROM_STAGE[cup.competitionId];
  if (fromStageNum === undefined) continue;
  // Determine highest stage OL has reached (or scheduled to play)
  const olStageNumbers = (
    cup.matches
      .map((m) => this.stageFrToNum(cup.competitionId, m.stageFr))
      .filter((n): n is number => n !== null)
  );
  const olMaxStage = olStageNumbers.length ? Math.max(...olStageNumbers) : 0;
  if (olMaxStage < fromStageNum) continue;
  const bracket = await this.bracketService.fetchBracket(cup.competitionId, fromStageNum, seasonStart);
  if (bracket) cup.bracket = bracket;
}
```

Add the helper method on `CupsService`:

```ts
private stageFrToNum(competitionId: number, stageFr: string): number | null {
  const stages = COMP_STAGES[competitionId] ?? {};
  for (const [num, label] of Object.entries(stages)) {
    if (label === stageFr || stageFr.startsWith(label)) return Number(num);
  }
  return null;
}
```

- [ ] **Step 2: Bust the existing cups cache (schema changed)**

The new `bracket` field requires a fresh fetch. Add `OnModuleInit` to the class and unconditionally remove the cache file at boot — the cache is 2h TTL so the cost is negligible and we avoid serving stale objects without `bracket`. Import `OnModuleInit` from `@nestjs/common` if not already imported.

```ts
@Injectable()
export class CupsService implements OnModuleInit {
  // ...

  onModuleInit() {
    try {
      if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    } catch (err) {
      this.logger.warn(`Could not invalidate cups cache: ${(err as Error).message}`);
    }
  }
}
```

(Phase 6 Task 6.4 will extend this `onModuleInit()` to also kick a first refresh.)

- [ ] **Step 3: Type check & test build**

```bash
cd backend && npx tsc --noEmit
cd backend && npx jest
```

Expected: green; no test regression.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/cups/cups.service.ts
git commit -m "feat(ol-companion/cups): wire BracketService into getCups response"
```

---

## Phase 4 — Bracket frontend (Feature 2 frontend)

### Task 4.1: Composant `<BracketMatch>` (card individuelle)

**Files:**
- Create: `frontend/src/components/bracket-match.tsx`

- [ ] **Step 1: Create component**

```tsx
import type { BracketMatch as BracketMatchType } from '@/types/api';
import { cn } from '@/lib/utils';

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

interface Props { match: BracketMatchType }

export function BracketMatch({ match }: Props) {
  const { homeTeam, awayTeam, homeScore, awayScore, status, hasOL } = match;
  const isFinished = status === 'FINISHED';
  const homeWon = isFinished && homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = isFinished && homeScore !== null && awayScore !== null && awayScore > homeScore;

  return (
    <div
      className={cn(
        'rounded-md border bg-surface p-2 text-sm',
        hasOL ? 'border-ol-red bg-ol-red/10' : 'border-border',
      )}
    >
      <Row name={homeTeam} score={homeScore} won={homeWon} dim={isFinished && !homeWon} highlight={hasOL && homeTeam.toLowerCase() === 'lyon'} />
      <Row name={awayTeam} score={awayScore} won={awayWon} dim={isFinished && !awayWon} highlight={hasOL && awayTeam.toLowerCase() === 'lyon'} />
      {!isFinished && (
        <div className="text-[10px] uppercase tracking-wider text-fg-dim mt-1">
          {formatShortDate(match.date)}
        </div>
      )}
    </div>
  );
}

function Row({ name, score, won, dim, highlight }: { name: string; score: number | null; won: boolean; dim: boolean; highlight: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-2 leading-tight py-0.5',
      won && 'text-fg-bright font-semibold',
      dim && 'text-fg-dim',
      highlight && 'font-semibold',
    )}>
      <span className="truncate">{name || '—'}</span>
      <span className="num tabular-nums">{score ?? ''}</span>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/bracket-match.tsx
git commit -m "feat(ol-companion/cups): BracketMatch card component"
```

### Task 4.2: Composant `<Bracket>` (layout multi-stages)

**Files:**
- Create: `frontend/src/components/bracket.tsx`

- [ ] **Step 1: Create component**

```tsx
import type { BracketInfo } from '@/types/api';
import { BracketMatch } from './bracket-match';

interface Props { bracket: BracketInfo }

export function Bracket({ bracket }: Props) {
  if (!bracket.stages.length) return null;

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="eyebrow mb-2">Tableau</div>
      {/* Desktop: horizontal columns per stage with simple connectors */}
      <div className="hidden md:flex gap-3">
        {bracket.stages.map((stage) => (
          <div key={stage.stageNum} className="flex-1 min-w-[180px]">
            <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2 text-center">
              {stage.stageFr}
            </div>
            <div className="flex flex-col gap-3 justify-around h-full">
              {stage.matches.map((m) => (
                <BracketMatch key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Mobile: vertical stack per stage */}
      <div className="md:hidden space-y-3">
        {bracket.stages.map((stage) => (
          <div key={stage.stageNum}>
            <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1.5">
              {stage.stageFr}
            </div>
            <div className="space-y-2">
              {stage.matches.map((m) => (
                <BracketMatch key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/bracket.tsx
git commit -m "feat(ol-companion/cups): Bracket layout component (desktop columns / mobile stack)"
```

### Task 4.3: Câbler `<Bracket>` dans `cups.tsx:CupCard`

**Files:**
- Modify: `frontend/src/routes/cups.tsx`

- [ ] **Step 1: Import `Bracket`**

Add at the top of `cups.tsx` near other component imports:

```ts
import { Bracket } from '@/components/bracket';
```

- [ ] **Step 2: Render the bracket above the matches list**

Inside the existing `CupCard` function, locate the JSX block:

```tsx
<div className="p-4 space-y-3">
  {cup.matches.length === 0 && (
    <p className="text-center text-fg-muted py-6">Aucun match disponible.</p>
  )}
  {cup.matches.map((m) => (
    <CupMatchRow key={m.id} match={m} />
  ))}
</div>
```

Replace it with:

```tsx
<div className="p-4 space-y-4">
  {cup.bracket && (
    <Bracket bracket={cup.bracket} />
  )}
  <div className="space-y-3">
    {cup.matches.length === 0 && (
      <p className="text-center text-fg-muted py-6">Aucun match disponible.</p>
    )}
    {cup.matches.map((m) => (
      <CupMatchRow key={m.id} match={m} />
    ))}
  </div>
</div>
```

- [ ] **Step 3: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/cups.tsx
git commit -m "feat(ol-companion/cups): render Bracket above match list when present"
```

---

## Phase 5 — PinGuard port (Feature 3 prep)

### Task 5.1: Porter `PinGuard` depuis warhammer40k

**Files:**
- Create: `backend/src/guards/pin.guard.ts`

- [ ] **Step 1: Copy & adapt the guard**

Create `backend/src/guards/pin.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * PIN guard for write/admin endpoints.
 * - If APP_PIN is unset → all requests pass (dev/local mode).
 * - Otherwise client must send `Authorization: Bearer <pin>`.
 */
@Injectable()
export class PinGuard implements CanActivate {
  private readonly pin: string;

  constructor() {
    this.pin = process.env['APP_PIN'] ?? '';
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.pin) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'] ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (token === this.pin) return true;
    throw new UnauthorizedException('PIN invalide');
  }
}
```

- [ ] **Step 2: Type check**

```bash
cd backend && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add backend/src/guards/pin.guard.ts
git commit -m "feat(ol-companion/auth): port PinGuard for admin endpoints"
```

---

## Phase 6 — Migration scheduler (Feature 3, étape 1)

### Task 6.1: Activer `ScheduleModule` dans `AppModule`

**Files:**
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Edit `AppModule`**

Add at top with other imports:

```ts
import { ScheduleModule } from '@nestjs/schedule';
```

Add `ScheduleModule.forRoot()` to `imports`:

```ts
@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    ScheduleModule.forRoot(),
    EventsModule,
    // ...rest unchanged
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Boot smoke test**

```bash
cd backend && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add backend/src/app.module.ts
git commit -m "feat(ol-companion): enable ScheduleModule"
```

### Task 6.2: Migrer `FixturesService` vers `@Cron`

**Files:**
- Modify: `backend/src/modules/fixtures/fixtures.service.ts`

- [ ] **Step 1: Replace `setInterval` with `@Cron`**

In `backend/src/modules/fixtures/fixtures.service.ts`:

- Add import: `import { Cron } from '@nestjs/schedule';`
- Remove the `REFRESH_INTERVAL_MS` constant.
- Remove `OnModuleDestroy` from imports and class signature; remove the `refreshTimer` property and `onModuleDestroy()`.
- Replace `onModuleInit()` body to keep the boot-time refresh:

```ts
onModuleInit() {
  this.getFixtures({ force: true }).catch((err) =>
    this.logger.warn(`Initial fixtures refresh failed: ${(err as Error).message}`),
  );
}

@Cron('0 */30 * * * *', { name: 'fixtures-refresh', timeZone: 'Europe/Paris' })
async scheduledRefresh() {
  await this.getFixtures({ force: true }).catch((err) =>
    this.logger.warn(`Periodic fixtures refresh failed: ${(err as Error).message}`),
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd backend && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/fixtures/fixtures.service.ts
git commit -m "refactor(ol-companion/fixtures): setInterval → @Cron (every 30 min)"
```

### Task 6.3: Migrer `StandingsService` vers `@Cron`

**Files:**
- Modify: `backend/src/modules/standings/standings.service.ts`

- [ ] **Step 1: Replace `setInterval` with `@Cron`**

Same pattern as Task 6.2:

- Add import: `import { Cron } from '@nestjs/schedule';`
- Remove `REFRESH_INTERVAL_MS`, `OnModuleDestroy`, `refreshTimer`, and `onModuleDestroy()`.
- Update `onModuleInit()` to keep `ensureHistoryFile()` and trigger one refresh:

```ts
onModuleInit() {
  this.ensureHistoryFile();
  this.getCurrentStandings({ force: true }).catch((err) =>
    this.logger.warn(`Initial standings refresh failed: ${(err as Error).message}`),
  );
}

@Cron('0 0 * * * *', { name: 'standings-refresh', timeZone: 'Europe/Paris' })
async scheduledRefresh() {
  await this.getCurrentStandings({ force: true }).catch((err) =>
    this.logger.warn(`Periodic standings refresh failed: ${(err as Error).message}`),
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd backend && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/standings/standings.service.ts
git commit -m "refactor(ol-companion/standings): setInterval → @Cron (hourly)"
```

### Task 6.4: Ajouter `@Cron` à `CupsService`

**Files:**
- Modify: `backend/src/modules/cups/cups.service.ts`

- [ ] **Step 1: Extend `getCups` signature with optional `force` flag**

Update method signature and bypass the cache when forced:

```ts
async getCups(opts: { force?: boolean } = {}): Promise<CupInfo[]> {
  if (!opts.force) {
    const cached = this.readCache();
    if (cached) return cached;
  }
  // ...existing fetch + cache-write logic unchanged
}
```

- [ ] **Step 2: Extend `onModuleInit` and add `@Cron`**

Add `import { Cron } from '@nestjs/schedule';`. Merge the boot refresh into the cache-bust `onModuleInit()` defined in Task 3.4:

```ts
onModuleInit() {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
  } catch (err) {
    this.logger.warn(`Could not invalidate cups cache: ${(err as Error).message}`);
  }
  this.getCups({ force: true }).catch((err) =>
    this.logger.warn(`Initial cups refresh failed: ${(err as Error).message}`),
  );
}

@Cron('0 0 */2 * * *', { name: 'cups-refresh', timeZone: 'Europe/Paris' })
async scheduledRefresh() {
  await this.getCups({ force: true }).catch((err) =>
    this.logger.warn(`Periodic cups refresh failed: ${(err as Error).message}`),
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/cups/cups.service.ts
git commit -m "feat(ol-companion/cups): periodic refresh via @Cron (2h)"
```

### Task 6.5: Ajouter `@Cron` à `NewsService`

**Files:**
- Modify: `backend/src/modules/news/news.service.ts`

- [ ] **Step 1: Add the decorator**

Add: `import { Cron } from '@nestjs/schedule';`

Extend the class to expose a force option and add the scheduled refresh:

```ts
async getNews(opts: { force?: boolean } = {}): Promise<NewsItem[]> {
  if (!opts.force) {
    const cached = this.readCache();
    if (cached) return cached;
  }
  // existing fetching logic unchanged
  // ...
}

onModuleInit() {
  this.getNews({ force: true }).catch((err) =>
    this.logger.warn(`Initial news refresh failed: ${(err as Error).message}`),
  );
}

@Cron('0 */30 * * * *', { name: 'news-refresh', timeZone: 'Europe/Paris' })
async scheduledRefresh() {
  await this.getNews({ force: true }).catch((err) =>
    this.logger.warn(`Periodic news refresh failed: ${(err as Error).message}`),
  );
}
```

Make the class implement `OnModuleInit` (`import { OnModuleInit } from '@nestjs/common'`).

- [ ] **Step 2: Type check & tests**

```bash
cd backend && npx tsc --noEmit
cd backend && npx jest
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/news/news.service.ts
git commit -m "feat(ol-companion/news): periodic refresh via @Cron (30 min)"
```

### Task 6.6: Ajouter `@Cron` à `LineupService`

**Files:**
- Modify: `backend/src/modules/lineup/lineup.service.ts`

- [ ] **Step 1: Add `force` option to `getLatestLineup` and a `@Cron`**

The current public method is `getLatestLineup(): Promise<LineupResponse | null>`. Extend its signature and add scheduled refresh:

```ts
import { Cron } from '@nestjs/schedule';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class LineupService implements OnModuleInit {
  // ... existing fields

  async getLatestLineup(opts: { force?: boolean } = {}): Promise<LineupResponse | null> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }
    // ...existing fetch + parse logic unchanged
  }

  onModuleInit() {
    this.getLatestLineup({ force: true }).catch((err) =>
      this.logger.warn(`Initial lineup refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 */15 * * * *', { name: 'lineup-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getLatestLineup({ force: true }).catch((err) =>
      this.logger.warn(`Periodic lineup refresh failed: ${(err as Error).message}`),
    );
  }
}
```

If the lineup controller already calls `getLatestLineup()` without args, the new optional parameter keeps backward compatibility.

- [ ] **Step 2: Type check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/lineup/lineup.service.ts
git commit -m "feat(ol-companion/lineup): periodic refresh via @Cron (15 min)"
```

---

## Phase 7 — Reset saison (Feature 3, étape 2)

### Task 7.1: Tests pour `SeasonResetService`

**Files:**
- Create: `backend/src/modules/scheduler/season-reset.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SeasonResetService } from './season-reset.service';

describe('SeasonResetService', () => {
  let dataDir: string;
  let service: SeasonResetService;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-reset-'));
    service = new SeasonResetService(dataDir);
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('archives existing caches into data/archive/<season>/ and clears them', async () => {
    fs.writeFileSync(path.join(dataDir, 'cups-cache.json'), '{"data":1}');
    fs.writeFileSync(path.join(dataDir, 'fixtures-cache.json'), '{"data":2}');
    fs.writeFileSync(path.join(dataDir, 'standings-history.json'), '[]');

    await service.resetSeason(new Date('2026-08-01T03:00:00'));

    const archive = path.join(dataDir, 'archive', '2025-2026');
    expect(fs.existsSync(path.join(archive, 'cups-cache.json'))).toBe(true);
    expect(fs.existsSync(path.join(archive, 'fixtures-cache.json'))).toBe(true);
    expect(fs.existsSync(path.join(archive, 'standings-history.json'))).toBe(true);

    expect(fs.existsSync(path.join(dataDir, 'cups-cache.json'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'fixtures-cache.json'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'standings-history.json'))).toBe(false);
  });

  it('ignores files that do not exist', async () => {
    // dataDir is empty
    await expect(service.resetSeason(new Date('2026-08-01T03:00:00'))).resolves.not.toThrow();
    expect(fs.existsSync(path.join(dataDir, 'archive', '2025-2026'))).toBe(true);
  });

  it('returns the archived season id', async () => {
    const result = await service.resetSeason(new Date('2026-08-01T03:00:00'));
    expect(result).toEqual({ archivedSeason: '2025-2026' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest src/modules/scheduler/season-reset.service.spec.ts
```

Expected: FAIL — service doesn't exist.

### Task 7.2: Implémenter `SeasonResetService`

**Files:**
- Create: `backend/src/modules/scheduler/season-reset.service.ts`

- [ ] **Step 1: Implement**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { getPreviousSeason } from './season.util';

const CACHES_TO_ARCHIVE = [
  'cups-cache.json',
  'fixtures-cache.json',
  'standings-cache.json',
  'news-cache.json',
  'lineup-cache.json',
  'standings-history.json',
  'season-rankings.json',
];

@Injectable()
export class SeasonResetService {
  private readonly logger = new Logger(SeasonResetService.name);
  private readonly dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? path.resolve(process.cwd(), 'data');
  }

  // 1 août, 03:00 Europe/Paris (cron 6 fields: sec min hour day month dow)
  @Cron('0 0 3 1 8 *', { name: 'season-reset', timeZone: 'Europe/Paris' })
  async scheduledReset(): Promise<{ archivedSeason: string }> {
    return this.resetSeason();
  }

  async resetSeason(now: Date = new Date()): Promise<{ archivedSeason: string }> {
    const season = getPreviousSeason(now);
    const archiveDir = path.join(this.dataDir, 'archive', season.id);
    fs.mkdirSync(archiveDir, { recursive: true });

    for (const filename of CACHES_TO_ARCHIVE) {
      const src = path.join(this.dataDir, filename);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(archiveDir, filename);
      fs.renameSync(src, dst);
      this.logger.log(`Archived ${filename} → archive/${season.id}/`);
    }

    this.logger.log(`Season reset complete: archived ${season.id}`);
    return { archivedSeason: season.id };
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd backend && npx jest src/modules/scheduler/season-reset.service.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/scheduler/season-reset.service.ts backend/src/modules/scheduler/season-reset.service.spec.ts
git commit -m "feat(ol-companion/scheduler): SeasonResetService archives caches every 1 August"
```

### Task 7.3: Endpoint admin `POST /api/admin/reset-season`

**Files:**
- Create: `backend/src/modules/scheduler/admin.controller.ts`

- [ ] **Step 1: Create controller**

```ts
import { Controller, Post, UseGuards } from '@nestjs/common';
import { PinGuard } from '../../guards/pin.guard';
import { SeasonResetService } from './season-reset.service';

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

- [ ] **Step 2: Type check**

```bash
cd backend && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/scheduler/admin.controller.ts
git commit -m "feat(ol-companion/scheduler): admin endpoint POST /api/admin/reset-season"
```

### Task 7.4: Créer `SchedulerModule` et l'enregistrer

**Files:**
- Create: `backend/src/modules/scheduler/scheduler.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create module**

```ts
import { Module } from '@nestjs/common';
import { SeasonResetService } from './season-reset.service';
import { AdminController } from './admin.controller';

@Module({
  providers: [SeasonResetService],
  controllers: [AdminController],
  exports: [SeasonResetService],
})
export class SchedulerModule {}
```

- [ ] **Step 2: Register in `AppModule`**

Add to `backend/src/app.module.ts` imports:

```ts
import { SchedulerModule } from './modules/scheduler/scheduler.module';
```

And inside the `imports: [...]` array (after `ScheduleModule.forRoot()`):

```ts
SchedulerModule,
```

- [ ] **Step 3: Boot smoke + type check**

```bash
cd backend && npx tsc --noEmit
cd backend && npx jest
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/scheduler/scheduler.module.ts backend/src/app.module.ts
git commit -m "feat(ol-companion/scheduler): wire SchedulerModule into AppModule"
```

---

## Phase 8 — Build, deploy & manual validation

### Task 8.1: Build local

**Files:**
- (no source changes; verification step)

- [ ] **Step 1: Backend build**

```bash
cd backend && npm run build
```

Expected: exit 0, `dist/` folder present, no `error TS` in output.

- [ ] **Step 2: Frontend build**

```bash
cd frontend && npm run build
```

Expected: exit 0, `dist/` folder present.

- [ ] **Step 3: Run all tests one final time**

```bash
cd backend && npx jest
```

Expected: all suites pass.

### Task 8.2: Sync sources to NAS and rebuild Docker images

**Files:**
- (deploy step; no source change)

- [ ] **Step 1: Sync source tree to NAS**

```bash
rsync -avz --delete --exclude node_modules --exclude dist --exclude .git \
  -e 'ssh -p 622' \
  /home/sylvain_ladoire/projects/developpeur/ol-companion/ \
  nas:/volume2/docker/developpeur/ol-companion/
```

Expected: rsync output lists modified files only.

- [ ] **Step 2: Rebuild backend container**

```bash
ssh -p 622 nas "docker compose -f /volume2/docker/developpeur/ol-companion/docker-compose.yml up -d --build --force-recreate --no-deps ol-backend"
```

Expected: image rebuilt, container recreated. `docker compose ... logs --tail 20 ol-backend` should show:
- "ScheduleModule" registration
- one log line per `@Cron` registered (Nest logs each named cron at boot in dev mode; otherwise look for the first scheduled refresh log).
- No `error TS` (cf. lesson `docker_silent_ts_errors.md` — grep the build output explicitly).

- [ ] **Step 3: Rebuild frontend container**

```bash
ssh -p 622 nas "docker compose -f /volume2/docker/developpeur/ol-companion/docker-compose.yml up -d --build --force-recreate --no-deps ol-frontend"
```

Expected: rebuild successful.

### Task 8.3: Manual validation

- [ ] **Step 1: News fix smoke test**

Open `http://nas:4202/news` in a browser. Confirm Google News cards display plain text in the description (no `<a href=…>` markup). Cross-check L'Équipe and Olympique-et-Lyonnais cards still render normally.

- [ ] **Step 2: Bracket smoke test (only if OL has reached the threshold)**

Open `http://nas:4202/cups`. If OL is in the CdF quarter-finals or beyond (or EL round of 16+), confirm a bracket appears above the matches list with the OL match highlighted in red. If OL hasn't reached the threshold, the bracket should NOT appear (only the matches list).

If you want to force-test without OL reaching the threshold, you can temporarily lower the threshold in `BRACKET_FROM_STAGE` in `cups.service.ts` and rebuild — revert after.

- [ ] **Step 3: Scheduler logs**

```bash
ssh -p 622 nas "docker compose -f /volume2/docker/developpeur/ol-companion/docker-compose.yml logs --tail 100 ol-backend | grep -E 'scheduledRefresh|fixtures-refresh|standings-refresh|cups-refresh|news-refresh|lineup-refresh'"
```

Expected: log lines confirm scheduled jobs registered/firing.

- [ ] **Step 4: Manual season reset**

```bash
curl -X POST http://nas:3002/api/admin/reset-season
# (or with PIN if APP_PIN is set: curl -X POST http://nas:3002/api/admin/reset-season -H "Authorization: Bearer $APP_PIN")
```

Expected response: `{"archivedSeason":"2024-2025"}` (in May 2026). Verify on the NAS:

```bash
ssh -p 622 nas "ls /volume2/docker/developpeur/data/ol/archive/2024-2025/"
```

Expected: archived JSON files present. Run the cron crons should regenerate fresh caches at their next tick — check `ls /volume2/docker/developpeur/data/ol/` after a few minutes.

- [ ] **Step 5: Final commit (if any tracked files were touched during validation, e.g. revert a temporary threshold change)**

```bash
git status
git diff
# commit any leftover, or confirm clean tree
```

---

## Hors scope (rappel)

- Refonte complète du parser RSS.
- Sources de données alternatives pour le bracket (UEFA.com, FFF.fr).
- Notifications push lors d'un reset de saison.
- Frontend bracket sur la page d'accueil ou les pages joueurs.
