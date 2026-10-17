import type { NewsItem } from '@/types/api';

// L5/t7 — Google News met l'éditeur en fin de titre (« Titre - Éditeur ») et répète le titre
// en description (parfois groupée avec d'autres titres : masquée dès qu'elle commence par le
// titre). On les remet à leur place pour l'affichage : titre seul, éditeur comme source de la
// carte, pas de description qui redit le titre. Module pur ; le filtre par source de la page garde la source du flux (« Google News »).

const GOOGLE_NEWS = 'Google News';
const SEPARATEUR = ' - ';

export interface NewsDisplay {
  title: string;
  source: string;
  description: string;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Vrai si la description ne dit rien de plus que le titre et l'éditeur. */
function repeteLeTitre(description: string, ...connus: string[]): boolean {
  let reste = normalise(description);
  for (const c of connus.map(normalise).filter(Boolean).sort((a, b) => b.length - a.length)) {
    reste = reste.split(c).join(' ');
  }
  return reste.replace(/[^\p{L}\p{N}]/gu, '') === '';
}

/** Vrai si la description commence par le titre (carte Google News groupée : « Titre… Éditeur Titre2 Éditeur… »). */
function commenceParLeTitre(description: string, ...titres: string[]): boolean {
  const d = normalise(description);
  return titres.map(normalise).some((t) => t !== '' && d.startsWith(t));
}

export function displayNews(item: NewsItem): NewsDisplay {
  let { title, source } = item;
  let editeur = '';
  if (item.source === GOOGLE_NEWS) {
    const i = title.lastIndexOf(SEPARATEUR);
    if (i > 0 && title.slice(i + SEPARATEUR.length).trim()) {
      editeur = title.slice(i + SEPARATEUR.length).trim();
      title = title.slice(0, i).trim();
      source = editeur;
    }
  }
  const description =
    repeteLeTitre(item.description, item.title, title, editeur) || commenceParLeTitre(item.description, item.title, title)
      ? '' : item.description;
  return { title, source, description };
}
