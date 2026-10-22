import { SquadsResponseSchema } from './scores365-squads';

describe('SquadsResponseSchema — forme de /web/squads, partagée par l\'effectif de l\'OL et celui des Bleus (L210)', () => {
  it('lit à la fois l\'âge et le numéro de maillot, et garde les champs inconnus', () => {
    const out = SquadsResponseSchema.parse({
      squads: [{ competitorId: 465, athletes: [{ id: 1, name: 'A', age: 30, jerseyNum: 9, position: { id: 4, name: 'x' }, extra: true }] }],
    });
    expect(out.squads?.[0].athletes?.[0]).toMatchObject({ id: 1, age: 30, jerseyNum: 9, extra: true });
  });

  it('accepte un joueur sans âge, sans numéro et sans poste', () => {
    expect(SquadsResponseSchema.safeParse({ squads: [{ athletes: [{ id: 1, name: 'A' }] }] }).success).toBe(true);
  });

  it('refuse un poste qui n\'est plus un objet', () => {
    expect(SquadsResponseSchema.safeParse({ squads: [{ athletes: [{ id: 1, name: 'A', position: 3 }] }] }).success).toBe(false);
  });
});
