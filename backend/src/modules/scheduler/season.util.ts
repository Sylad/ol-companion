export interface Season {
  id: string;
  startDate: Date;
  endDate: Date;
}

export function getCurrentSeason(d: Date = new Date()): Season {
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const startYear = month >= 8 ? year : year - 1;
  return {
    id: `${startYear}-${startYear + 1}`,
    startDate: new Date(`${startYear}-08-01T00:00:00Z`),
    endDate: new Date(`${startYear + 1}-07-31T23:59:59Z`),
  };
}

export function getPreviousSeason(d: Date = new Date()): Season {
  const current = getCurrentSeason(d);
  const prevAnchor = new Date(current.startDate);
  prevAnchor.setFullYear(prevAnchor.getFullYear() - 1);
  return getCurrentSeason(prevAnchor);
}
