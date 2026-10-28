import { readFileSync } from 'fs';
import { join } from 'path';
import { TRACKED_COMPETITIONS } from './season-matches.service';

/**
 * Le frontend recopie identifiant 365scores → code (`CODE_BY_365SCORES_ID`,
 * `frontend/src/lib/competitions.ts`) : cette table doit rester égale à
 * `TRACKED_COMPETITIONS`, sinon une compétition suivie ajoutée ici seulement
 * retombe sur le nom brut 365scores dans /match, la carte du direct et « Dernier match ».
 */
describe('miroir frontend de TRACKED_COMPETITIONS', () => {
  it('liste les mêmes identifiants avec les mêmes codes', () => {
    const source = readFileSync(
      join(__dirname, '../../../../frontend/src/lib/competitions.ts'),
      'utf8',
    );
    const block = /CODE_BY_365SCORES_ID[^=]*=\s*\{([^}]*)\}/.exec(source);
    expect(block).not.toBeNull();
    const mirror: Record<number, string> = {};
    for (const m of block![1].matchAll(/(\d+):\s*'(\w+)'/g)) {
      mirror[Number(m[1])] = m[2];
    }
    const tracked: Record<number, string> = {};
    for (const [id, { code }] of Object.entries(TRACKED_COMPETITIONS)) {
      tracked[Number(id)] = code;
    }
    expect(mirror).toEqual(tracked);
  });
});
