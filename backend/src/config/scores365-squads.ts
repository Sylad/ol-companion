import { z } from 'zod';

/**
 * Forme de `/web/squads` (365scores), lue par l'effectif de l'OL (`SquadService`) et celui des Bleus (`FranceService`) :
 * un seul schéma, pour qu'un changement de forme se corrige en un seul endroit. Âge et numéro de maillot sont
 * facultatifs, chaque lecteur prend celui dont il a besoin.
 */
export const SquadsResponseSchema = z.object({
  squads: z
    .array(
      z.object({
        competitorId: z.number().optional(),
        athletes: z
          .array(
            z
              .object({
                id: z.number(),
                name: z.string(),
                age: z.number().optional(),
                jerseyNum: z.number().optional(),
                position: z.object({ id: z.number().optional(), name: z.string().optional() }).optional(),
              })
              .passthrough(),
          )
          .optional(),
      }),
    )
    .optional(),
});
