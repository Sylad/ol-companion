import { describe, expect, it, vi } from 'vitest';
import { estErreurDeModule, rechargerUneFois, installerRechargementModule } from './rechargement-module';

// L184 — après une livraison, l'onglet ouvert réclame un module à l'ancien hash, qui n'existe plus.

function stockage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe('Rechargement sur module introuvable (L184)', () => {
  it('R1 — reconnaît l\'échec de chargement d\'un module dans les trois navigateurs, pas une erreur ordinaire', () => {
    expect(estErreurDeModule(new TypeError('Failed to fetch dynamically imported module: https://ol.sladoire.dev/assets/match-abc.js'))).toBe(true);
    expect(estErreurDeModule(new TypeError('error loading dynamically imported module: https://x/assets/match-abc.js'))).toBe(true);
    expect(estErreurDeModule(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(estErreurDeModule(new Error('Unable to preload CSS for /assets/index-abc.css'))).toBe(true);
    expect(estErreurDeModule(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(estErreurDeModule(undefined)).toBe(false);
    expect(estErreurDeModule('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('R2 — recharge la page une fois, et pas une seconde fois dans la minute (garde contre la boucle)', () => {
    const s = stockage();
    const recharger = vi.fn();
    expect(rechargerUneFois({ storage: s, recharger, maintenant: () => 1_000_000 })).toBe(true);
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(rechargerUneFois({ storage: s, recharger, maintenant: () => 1_030_000 })).toBe(false);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('R3 — une livraison ultérieure, plus d\'une minute après, recharge de nouveau', () => {
    const s = stockage();
    const recharger = vi.fn();
    rechargerUneFois({ storage: s, recharger, maintenant: () => 1_000_000 });
    expect(rechargerUneFois({ storage: s, recharger, maintenant: () => 1_000_000 + 61_000 })).toBe(true);
    expect(recharger).toHaveBeenCalledTimes(2);
  });

  it('R4 — sessionStorage inaccessible : aucun rechargement (une boucle serait possible)', () => {
    const recharger = vi.fn();
    const casse = { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } };
    expect(rechargerUneFois({ storage: casse, recharger, maintenant: () => 1 })).toBe(false);
    expect(recharger).not.toHaveBeenCalled();
  });

  it('R5 — vite:preloadError déclenche le rechargement et neutralise l\'erreur', () => {
    const cible = new EventTarget();
    const recharger = vi.fn();
    installerRechargementModule(cible, { storage: stockage(), recharger, maintenant: () => 5 });
    const ev = new Event('vite:preloadError', { cancelable: true });
    cible.dispatchEvent(ev);
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });
});
