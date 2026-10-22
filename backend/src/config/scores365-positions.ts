/**
 * Les quatre postes d'un effectif 365scores (`/web/squads`), par identifiant (stable d'une langue à
 * l'autre, contrairement aux noms). Le staff (Entraîneur, Assistant Coach) a `position.id` 0 : écarté.
 */
export const POSITION_BY_ID: Record<number, string> = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Attacker' };
