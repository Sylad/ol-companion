import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// L70 — leaflet.css (chargé à la demande avec la carte, donc APRÈS index.css) pose
// `.leaflet-popup-content-wrapper, .leaflet-popup-tip { background: white }` : à
// spécificité égale il gagnait, et la bulle sombre devenait blanche (texte clair
// sur blanc, 1,09:1). La règle de thème doit donc être plus spécifique.
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

describe('thème sombre de la bulle Leaflet (L70)', () => {
  it('le fond --surface est posé par un sélecteur plus spécifique que celui de leaflet.css', () => {
    const rule = css.match(/([^{}]*)\{[^{}]*background:\s*hsl\(var\(--surface\)\)[^{}]*\}/g)
      ?.find((r) => r.includes('leaflet-popup-content-wrapper'));
    expect(rule).toBeDefined();
    const selectors = rule!.split('{')[0].split(',').map((s) => s.trim());
    for (const s of selectors) {
      const classes = (s.match(/\.[\w-]+/g) ?? []).length;
      expect(classes, s).toBeGreaterThanOrEqual(2);
    }
  });
});
