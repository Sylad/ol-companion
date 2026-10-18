// @vitest-environment node
// L23 — la CI doit rendre ROUGE un plan publié périmé (commit qui ne touche que
// docs/plan, ex. `raf done`) et une fuite du plan dans le bundle : cadence deliver
// attend tous les runs du sha livré et échoue sur un run rouge.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../..', import.meta.url));
const WORKFLOW = `${root}/.github/workflows/frontend-checks.yml`;

describe('workflow frontend-checks.yml', () => {
  const wf = parse(readFileSync(WORKFLOW, 'utf8'));
  const steps = Object.values(wf.jobs).flatMap((j) => j.steps ?? []);
  const commands = steps.map((s) => String(s.run ?? '')).join('\n');

  it('tourne à CHAQUE push sur main, sans filtre de chemins (un commit de plan seul compte)', () => {
    expect(wf.on.push.branches).toEqual(['main']);
    expect(wf.on.push.paths).toBeUndefined();
    expect(wf.on.push['paths-ignore']).toBeUndefined();
  });

  it('vérifie que plan.json est à jour, lance les tests Vitest et le build (qui contrôle les fuites)', () => {
    expect(commands).toMatch(/node scripts\/plan-data\.mjs --check/);
    expect(commands).toMatch(/npx vitest run|npm test/);
    expect(commands).toMatch(/npm run build/);
    for (const s of steps.filter((x) => x.run)) expect(s['continue-on-error']).toBeUndefined();
  });

  it('ne conditionne pas les images (workflow séparé de build.yml, seul lu par deploy.sh)', () => {
    expect(WORKFLOW).not.toMatch(/build\.yml$/);
    const deploy = readFileSync(`${root}/scripts/deploy.sh`, 'utf8');
    expect(deploy).not.toMatch(/frontend-checks/);
  });

  it('npm run build se termine par la vérification de fuite du plan', () => {
    const pkg = JSON.parse(readFileSync(`${root}/frontend/package.json`, 'utf8'));
    expect(pkg.scripts.build).toMatch(/plan-data\.mjs --leaks dist$/);
  });

  // L182 — sans package-lock.json suivi, la CI résolvait d'autres versions que Big-Blue
  // (@tanstack/react-router 1.170.45 contre 1.169.2) et le test L180 y restait bloqué.
  it("L182 — package-lock.json est suivi par git et la CI installe avec npm ci, pas npm install", () => {
    const tracked = execFileSync('git', ['ls-files', 'frontend/package-lock.json'], { cwd: root, encoding: 'utf8' });
    expect(tracked.trim()).toBe('frontend/package-lock.json');
    expect(commands).toMatch(/npm ci/);
    expect(commands).not.toMatch(/npm install/);
  });

  it("L182 — le Dockerfile du frontend copie le lockfile et installe avec npm ci", () => {
    const dockerfile = readFileSync(`${root}/frontend/Dockerfile`, 'utf8');
    expect(dockerfile).toMatch(/^RUN npm ci\b/m);
    expect(dockerfile).not.toMatch(/npm install/);
    expect(dockerfile).toMatch(/^COPY package\*\.json/m);
  });
});
