/** Statuts 365scores d'un membre de composition : 1 titulaire, 2 remplaçant,
 *  3 hors du groupe, 4 staff (même lecture que `toLineups` du direct). */
const STATUS_STARTER = 1;
const STATUS_SUBSTITUTE = 2;
const STATUS_STAFF = 4;

export interface RoleMember {
  status?: number;
  isStarting: boolean;
  yardLine: number;
  position: string;
}

/** L'entraîneur arrive en `Management` : jamais joueur, même si le statut est faux. */
const isStaff = (m: RoleMember): boolean => m.status === STATUS_STAFF || m.position === 'Management';

export function splitLineupRoles<T extends RoleMember>(members: T[]): {
  starters: T[];
  bench: T[];
  unavailable: T[];
} {
  const players = members.filter((m) => !isStaff(m));
  return {
    starters: players.filter((m) => m.status === STATUS_STARTER || m.isStarting).sort((a, b) => a.yardLine - b.yardLine),
    bench: players.filter((m) => m.status === STATUS_SUBSTITUTE && !m.isStarting),
    unavailable: players.filter((m) => m.status !== STATUS_STARTER && m.status !== STATUS_SUBSTITUTE && !m.isStarting),
  };
}
