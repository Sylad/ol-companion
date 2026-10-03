import {
  isKickoffTimeConfirmed,
  KICKOFF_WINDOW_MS,
} from './kickoff-confirmation';

/**
 * L39 — la règle « l'heure du coup d'envoi est-elle fixée ? », branche par
 * branche. Chaque cas est écrit pour échouer si sa branche disparaît : vérifié
 * en appliquant les mutations une à une sur une copie (voir le message du
 * commit).
 *
 * Trois états de football-data pour une journée de Ligue 1 :
 * - il la donne en `TIMED` → heure fixée ;
 * - il la donne en `SCHEDULED` à minuit UTC → heure non fixée ;
 * - il n'en dit RIEN (pas de clé, pas de cache, appel en échec, journée au-delà
 *   de sa réponse) → l'heure de 365scores vaut dans les 14 jours, pas au-delà.
 */

const NOW = new Date('2026-10-03T12:00:00Z');
const DAY = 24 * 3600_000;

/** Un match de la saison (365scores), à `days` jours de NOW. */
function seasonMatch(
  partial: {
    competitionCode?: string;
    status?: string;
    matchday?: number | null;
    days?: number;
    date?: string;
  } = {},
) {
  return {
    competitionCode: partial.competitionCode ?? 'L1',
    status: partial.status ?? 'SCHEDULED',
    matchday: partial.matchday === undefined ? 6 : partial.matchday,
    date:
      partial.date ??
      new Date(NOW.getTime() + (partial.days ?? 6) * DAY).toISOString(),
  };
}

/** Ce que football-data dit d'une journée (`peekFixtures`). */
function footballData(
  matchday: number | null,
  timeConfirmed: boolean,
  competition = 'Ligue 1',
) {
  return { competition, matchday, timeConfirmed };
}

const confirmed = (
  match: ReturnType<typeof seasonMatch>,
  said: ReturnType<typeof footballData>[] = [],
) => isKickoffTimeConfirmed(match, said, NOW);

describe('isKickoffTimeConfirmed', () => {
  it('la fenêtre est de 14 jours', () => {
    expect(KICKOFF_WINDOW_MS).toBe(14 * DAY);
  });

  describe('match joué ou en cours : heure fixée, quoi que dise football-data', () => {
    // Sans la branche « joué ou en cours », ces matchs de Ligue 1 suivraient la
    // règle des matchs à venir, qui répond « non fixée » dans les deux cas.
    it.each(['FINISHED', 'IN_PLAY'])(
      '%s, football-data donnant la journée sans heure',
      (status) => {
        const match = seasonMatch({ status, matchday: 13, days: -2 });
        expect(confirmed(match, [footballData(13, false)])).toBe(true);
      },
    );

    it.each(['FINISHED', 'IN_PLAY'])(
      '%s, football-data muet et date à plus de 14 jours de l’horloge',
      (status) => {
        const match = seasonMatch({ status, matchday: 20, days: 40 });
        expect(confirmed(match, [])).toBe(true);
      },
    );
  });

  describe('autre compétition que la Ligue 1 : heure de 365scores tenue pour fixée', () => {
    // Sans la branche « hors Ligue 1 », ces matchs suivraient la règle de la
    // Ligue 1 : « non fixée » au-delà de 14 jours ou quand football-data donne
    // la journée de même numéro sans heure.
    it.each(['UEL', 'UCL', 'CDF'])(
      '%s à 60 jours, football-data muet',
      (competitionCode) => {
        const match = seasonMatch({ competitionCode, matchday: 4, days: 60 });
        expect(confirmed(match, [])).toBe(true);
      },
    );

    it('Ligue Europa J2 dans 12 jours, alors que football-data donne la J2 de Ligue 1 sans heure', () => {
      const match = seasonMatch({
        competitionCode: 'UEL',
        matchday: 2,
        days: 12,
      });
      expect(confirmed(match, [footballData(2, false)])).toBe(true);
    });

    it('tour de coupe sans journée, à 90 jours', () => {
      const match = seasonMatch({
        competitionCode: 'CDF',
        matchday: null,
        days: 90,
      });
      expect(confirmed(match, [footballData(null, false)])).toBe(true);
    });
  });

  describe('Ligue 1 à venir, football-data parle de la journée : il a le dernier mot', () => {
    it('TIMED : fixée, même au-delà de 14 jours', () => {
      const match = seasonMatch({ matchday: 12, days: 57 });
      expect(confirmed(match, [footballData(12, true)])).toBe(true);
    });

    it('SCHEDULED à minuit UTC : non fixée, même dans les 14 jours', () => {
      const match = seasonMatch({ matchday: 6, days: 3 });
      expect(confirmed(match, [footballData(6, false)])).toBe(false);
    });

    it('SCHEDULED à minuit UTC au-delà de 14 jours : non fixée', () => {
      const match = seasonMatch({ matchday: 13, days: 63 });
      expect(confirmed(match, [footballData(13, false)])).toBe(false);
    });

    it('c’est la journée qui apparie, pas la position dans la liste', () => {
      const said = [
        footballData(6, true),
        footballData(13, false),
        footballData(14, true),
      ];
      expect(confirmed(seasonMatch({ matchday: 13, days: 3 }), said)).toBe(
        false,
      );
      expect(confirmed(seasonMatch({ matchday: 14, days: 71 }), said)).toBe(
        true,
      );
    });
  });

  describe('Ligue 1 à venir, football-data muet : l’heure de 365scores vaut 14 jours', () => {
    const silent: [string, ReturnType<typeof footballData>[]][] = [
      ['sans clé, sans cache ou appel en échec (liste vide)', []],
      [
        'journée au-delà de sa réponse',
        [footballData(5, true), footballData(7, true)],
      ],
    ];

    describe.each(silent)('%s', (_label, said) => {
      it('match du lendemain : heure affichée', () => {
        expect(confirmed(seasonMatch({ days: 1 }), said)).toBe(true);
      });

      it('match dans 6 jours (J6 du 09-10 vu le 03-10) : heure affichée', () => {
        const lens = seasonMatch({ date: '2026-10-09T18:45:00.000Z' });
        expect(confirmed(lens, said)).toBe(true);
      });

      it('à 14 jours moins une milliseconde : heure affichée', () => {
        const match = seasonMatch({
          date: new Date(NOW.getTime() + 14 * DAY - 1).toISOString(),
        });
        expect(confirmed(match, said)).toBe(true);
      });

      it('à 14 jours pile : heure affichée (borne comprise)', () => {
        const match = seasonMatch({
          date: new Date(NOW.getTime() + 14 * DAY).toISOString(),
        });
        expect(confirmed(match, said)).toBe(true);
      });

      it('à 14 jours plus une milliseconde : à confirmer', () => {
        const match = seasonMatch({
          date: new Date(NOW.getTime() + 14 * DAY + 1).toISOString(),
        });
        expect(confirmed(match, said)).toBe(false);
      });

      it('dans 60 jours : à confirmer', () => {
        expect(confirmed(seasonMatch({ days: 60 }), said)).toBe(false);
      });
    });

    it('l’horloge est celle qu’on lui passe : le même match sort de la fenêtre quand on recule de 9 jours', () => {
      const lens = seasonMatch({ date: '2026-10-09T18:45:00.000Z' });
      expect(
        isKickoffTimeConfirmed(lens, [], new Date('2026-09-24T12:00:00Z')),
      ).toBe(false);
      expect(
        isKickoffTimeConfirmed(lens, [], new Date('2026-09-26T12:00:00Z')),
      ).toBe(true);
    });
  });

  describe('Ligue 1 sans journée : football-data ne peut pas être apparié, la fenêtre décide', () => {
    it('dans 6 jours : heure affichée, même si football-data a une entrée sans journée et sans heure', () => {
      const match = seasonMatch({ matchday: null, days: 6 });
      expect(confirmed(match, [footballData(null, false)])).toBe(true);
    });

    it('dans 60 jours : à confirmer, même si football-data a une entrée sans journée avec une heure', () => {
      const match = seasonMatch({ matchday: null, days: 60 });
      expect(confirmed(match, [footballData(null, true)])).toBe(false);
    });

    it('dans 60 jours, football-data muet : à confirmer', () => {
      expect(
        confirmed(seasonMatch({ matchday: null, days: 60 }), []),
      ).toBe(false);
    });
  });

  describe('journée de même numéro d’une AUTRE compétition côté football-data : ignorée', () => {
    it('Ligue 1 J2 dans 60 jours, football-data donne la J2 de Ligue des champions avec une heure : à confirmer', () => {
      const match = seasonMatch({ matchday: 2, days: 60 });
      const said = [footballData(2, true, 'UEFA Champions League')];
      expect(confirmed(match, said)).toBe(false);
    });

    it('Ligue 1 J2 dans 6 jours, football-data donne la J2 de Ligue des champions sans heure : heure affichée', () => {
      const match = seasonMatch({ matchday: 2, days: 6 });
      const said = [footballData(2, false, 'UEFA Champions League')];
      expect(confirmed(match, said)).toBe(true);
    });

    it('les deux journées de même numéro présentes : celle de Ligue 1 décide, quel que soit l’ordre', () => {
      const match = seasonMatch({ matchday: 2, days: 6 });
      const league = footballData(2, false);
      const champions = footballData(2, true, 'UEFA Champions League');
      expect(confirmed(match, [champions, league])).toBe(false);
      expect(confirmed(match, [league, champions])).toBe(false);
    });
  });
});
