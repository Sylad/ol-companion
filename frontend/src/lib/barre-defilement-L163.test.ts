import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');
const css = readFileSync(path.join(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Corps du premier bloc `{ … }` dont la liste de sélecteurs contient exactement `sel` (hors @media). */
const bloc = (sel: string, contient = '', apres = 0): string => {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  re.lastIndex = apres;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const liste = m[1].split(',').map((s) => s.trim().replace(/^@layer base\s*/, ''));
    if (liste.includes(sel) && m[2].includes(contient)) return m[2];
  }
  return '';
};
const jetonDe = (corps: string, nom: string): [number, number, number] | undefined => {
  const m = corps.match(new RegExp(`--${nom}:\\s*(\\d+) (\\d+)% (\\d+)%`));
  return m ? [+m[1], +m[2], +m[3]] : undefined;
};
const lum = ([h, s, l]: [number, number, number]) => {
  const S = s / 100, L = l / 100, a = S * Math.min(L, 1 - L);
  const f = (n: number) => { const k = (n + h / 30) % 12; return L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
};
const contraste = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const racine = bloc(':root');
const themes = {
  OL: { corps: racine, fond: jetonDe(racine, 'bg')! },
  'FC Noobz': { corps: bloc('body.theme-fcnoobz', '--sb-'), fond: jetonDe(racine, 'bg')! },
  Bleus: { corps: bloc('body.theme-bleus', '--sb-'), fond: jetonDe(racine, 'bg')! },
};
const lire = (corps: string, nom: string) => jetonDe(corps, nom) ?? jetonDe(racine, nom)!;

const fichiers = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(tsx|ts)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });

describe('L163 — barre de défilement uniformisée', () => {
  it('R1 — une seule source : jetons --sb-* dans :root, règles globales (page et conteneurs) qui ne lisent que ces jetons', () => {
    for (const j of ['sb-track', 'sb-track-edge', 'sb-thumb', 'sb-thumb-edge']) expect(jetonDe(racine, j), j).toBeDefined();
    const piste = bloc('::-webkit-scrollbar-track');
    const curseur = bloc('::-webkit-scrollbar-thumb');
    expect(piste).toContain('hsl(var(--sb-track))');
    expect(piste).toContain('hsl(var(--sb-track-edge))');
    expect(curseur).toContain('hsl(var(--sb-thumb))');
    expect(curseur).toContain('hsl(var(--sb-thumb-edge))');
    expect(piste + curseur).not.toMatch(/hsl\(\d/);
    expect(bloc('::-webkit-scrollbar')).toMatch(/width:\s*10px/);
  });

  it('R2 — aucun bouton fléché, piste et curseur arrondis à 5 px, halo néon sur le curseur (survol)', () => {
    expect(bloc('::-webkit-scrollbar-button')).toMatch(/display:\s*none/);
    expect(bloc('::-webkit-scrollbar-track')).toMatch(/border-radius:\s*5px/);
    expect(bloc('::-webkit-scrollbar-thumb')).toMatch(/border-radius:\s*5px/);
    expect(bloc('::-webkit-scrollbar-thumb')).toMatch(/box-shadow:[^;]*var\(--sb-glow\)/);
    expect(bloc('::-webkit-scrollbar-thumb:hover')).toMatch(/box-shadow:[^;]*var\(--sb-glow\)/);
  });

  it('R3 — FC Noobz : la palette lime (teinte 70–110) et bleu électrique (190–220) sous body.theme-fcnoobz, page comprise', () => {
    expect(css).toMatch(/:root:has\(body\.theme-fcnoobz\)\s*,\s*body\.theme-fcnoobz\s*\{/);
    const t = themes['FC Noobz'].corps;
    const lime = jetonDe(t, 'sb-thumb-edge')!;
    const bleu = jetonDe(t, 'sb-track-edge')!;
    expect(lime[0]).toBeGreaterThanOrEqual(70);
    expect(lime[0]).toBeLessThanOrEqual(110);
    expect(bleu[0]).toBeGreaterThanOrEqual(190);
    expect(bleu[0]).toBeLessThanOrEqual(220);
  });

  it('R4 — équipe de France : thème bleu blanc rouge sous body.theme-bleus, posé par la page /equipe-de-france', () => {
    expect(css).toMatch(/:root:has\(body\.theme-bleus\)\s*,\s*body\.theme-bleus\s*\{/);
    const t = themes.Bleus.corps;
    const blanc = jetonDe(t, 'sb-thumb')!;
    const rouge = jetonDe(t, 'sb-thumb-edge')!;
    const bleu = jetonDe(t, 'sb-track-edge')!;
    expect(blanc[2]).toBeGreaterThanOrEqual(90);
    expect(rouge[0] <= 10 || rouge[0] >= 350).toBe(true);
    expect(bleu[0]).toBeGreaterThanOrEqual(215);
    expect(bleu[0]).toBeLessThanOrEqual(235);
    const page = readFileSync(path.join(SRC, 'routes/equipe-de-france.tsx'), 'utf8');
    expect(page).toContain("classList.add('theme-bleus')");
    expect(page).toContain("classList.remove('theme-bleus')");
  });

  it.each(Object.keys(themes))('R5 — %s : bordure du curseur ≥ 3:1 sur la piste et bordure de la piste ≥ 3:1 sur le fond (WCAG 1.4.11)', (nom) => {
    const { corps, fond } = themes[nom as keyof typeof themes];
    expect(contraste(lire(corps, 'sb-thumb-edge'), lire(corps, 'sb-track'))).toBeGreaterThanOrEqual(3);
    expect(contraste(lire(corps, 'sb-track-edge'), fond)).toBeGreaterThanOrEqual(3);
  });

  it('R6 — Firefox : repli scrollbar-color sur les mêmes jetons, sous @supports not selector(::-webkit-scrollbar)', () => {
    const m = css.match(/@supports not selector\(\s*::-webkit-scrollbar\s*\)\s*\{\s*\*\s*\{([^}]*)\}/);
    expect(m?.[1]).toMatch(/scrollbar-color:\s*hsl\(var\(--sb-thumb-edge\)\)\s+hsl\(var\(--sb-track\)\)/);
  });

  it('R7 — aucun composant ne pose son propre scrollbar-width / scrollbar-color (Chrome 121+ ignorerait ::-webkit-scrollbar)', () => {
    const fautifs = fichiers(SRC).filter((f) => /scrollbar-(width|color|none)|no-scrollbar/.test(readFileSync(f, 'utf8')));
    expect(fautifs.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
