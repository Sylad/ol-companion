// L269 — composition de /match : une rangée de la formation tient sur une ligne ; un nom ne se coupe (syllabes, trait
// d'union, toujours à 12 px) qu'en dernier recours. La géométrie réelle se mesure dans Chromium
// (tests-navigateur/plancher-12px-L261.test.ts) ; ici, les règles pures avec une mesure de 6 px par caractère.
import { describe, expect, it } from 'vitest';
import { CESURE, coupuresSyllabiques, largeurMin, morceaux, nomCoupe, nomsDeRangee, rangeeTient } from './coupure-nom';

const mesure = (t: string) => Array.from(t).length * 6;
const lignes = (mot: string, positions: number[]) => {
  const c = Array.from(mot);
  return [0, ...positions].map((d, k) => c.slice(d, [...positions, c.length][k]).join(''));
};

describe('L269 — coupure des noms de la composition', () => {
  it('morceaux : coupure à l’espace et après le tiret, jamais ailleurs', () => {
    expect(morceaux('Z. Athekame')).toEqual(['Z.', 'Athekame']);
    expect(morceaux('Maitland-Niles')).toEqual(['Maitland-', 'Niles']);
    expect(morceaux('Çalhanoğlu')).toEqual(['Çalhanoğlu']);
  });

  it('syllabes : avant consonne + voyelle, attaque consonne + l/r gardée, digramme jamais coupé, 2 lettres avant et 3 après', () => {
    expect(lignes('Alexsandro', coupuresSyllabiques('Alexsandro'))).toEqual(['Alex', 'san', 'dro']);
    expect(lignes('Haraldsson', coupuresSyllabiques('Haraldsson'))).toEqual(['Ha', 'ralds', 'son']);
    expect(lignes('Athekame', coupuresSyllabiques('Athekame'))).toEqual(['Athe', 'kame']);
    expect(lignes('Çalhanoğlu', coupuresSyllabiques('Çalhanoğlu'))).toEqual(['Çal', 'ha', 'noğlu']);
    expect(lignes('Omobamidele', coupuresSyllabiques('Omobamidele'))).toEqual(['Omo', 'ba', 'mi', 'dele']);
    expect(coupuresSyllabiques('Ngoy')).toEqual([]);
  });

  it('un nom qui tient n’est pas touché ; un mot trop large reçoit des césures douces, le reste du nom non', () => {
    expect(nomCoupe('Perraud', mesure, 60)).toBe('Perraud');
    expect(nomCoupe('Z. Athekame', mesure, 40)).toBe(`Z. Athe${CESURE}kame`);
    expect(nomCoupe('Z. Athekame', mesure, 48)).toBe('Z. Athekame'); // 8 lettres × 6 = 48 : tient
    expect(nomCoupe('Maitland-Niles', mesure, 54)).toBe('Maitland-Niles');
  });

  it('syllabe trop large elle-même (trait d’union compris) : césures à toute position, 2 caractères de chaque côté', () => {
    // « ralds- » = 6 × 6 = 36 > 30 : césures partout.
    const n = nomCoupe('Haraldsson', mesure, 30);
    expect(n.replaceAll(CESURE, '')).toBe('Haraldsson');
    expect(n.split(CESURE).map((s) => s.length)).toEqual([2, 1, 1, 1, 1, 1, 1, 2]);
  });

  it('rangée : tient si la somme des mots les plus larges, des bords et des écarts de 4 px tient dans sa largeur', () => {
    const def = ['Perraud', 'Alexsandro', 'Nianzou', 'Ngoy']; // 42 + 60 + 42 + 24 = 168
    expect(rangeeTient(def, mesure, 6, 168 + 24 + 12)).toBe(true);
    expect(rangeeTient(def, mesure, 6, 168 + 24 + 11)).toBe(false);
    expect(rangeeTient(['Z. Athekame'], mesure, 6, 54)).toBe(true); // le morceau le plus large compte, pas le nom entier
  });

  it('largeur minimale : le morceau le plus large ; avec césures, la syllabe la plus large, trait d’union compris', () => {
    expect(largeurMin('Z. Athekame', mesure)).toBe(48);
    expect(largeurMin(`Athe${CESURE}kame`, mesure)).toBe(30); // « Athe- »
  });

  it('dernier recours minimal : seuls les noms les plus larges d’une rangée qui ne tient pas sont coupés, un à un', () => {
    const def = ['Elmali', 'E. Topçu', 'Bardakci', 'Demiral', 'Yilmaz']; // 36 + 30 + 48 + 42 + 36 = 192
    expect(nomsDeRangee(def, mesure, 6, 192 + 30 + 16, 30)).toEqual(def); // tient : rien de coupé
    const coupes = nomsDeRangee(def, mesure, 6, 192 + 30 + 16 - 10, 30);
    expect(coupes.filter((n, k) => n !== def[k])).toEqual([`Bar${CESURE}dakci`]); // le plus large seul suffit
    expect(rangeeTient(coupes, mesure, 6, 192 + 30 + 16 - 10)).toBe(true);
  });
});
