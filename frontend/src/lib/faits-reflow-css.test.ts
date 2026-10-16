import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// À spécificité égale, la règle écrite plus bas l'emporte : jsdom ne calcule pas la cascade, on vérifie l'ordre
// d'écriture dans la feuille.
const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');

describe('L161 — reflow des faits sous 390 px', () => {
  it('R1 — le bloc @media (max-width: 389px) des faits est écrit après les règles de base et après le @media 599px', () => {
    const reflow = css.indexOf('@media (max-width: 389px)');
    expect(reflow).toBeGreaterThan(-1);
    for (const base of [
      '.faits-liste .ev {',
      '.faits-liste .evm { text-align: center; }',
      '.faits-liste .evm small { display: block;',
      '.faits-liste .evl .fw, .faits-liste .evr .fw { display: -webkit-box;',
      '@media (max-width: 599px)',
    ]) {
      const i = css.indexOf(base);
      expect(i, base).toBeGreaterThan(-1);
      expect(reflow, base).toBeGreaterThan(i);
    }
  });
});
