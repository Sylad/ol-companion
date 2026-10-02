// @vitest-environment node
// L23 — la CI doit rendre ROUGE un plan publié périmé (commit qui ne touche que
// docs/plan, ex. `raf done`) et une fuite du plan dans le bundle : cadence deliver
// attend tous les runs du sha livré et échoue sur un run rouge.
import { readFileSync } from 'node:fs';
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
});
