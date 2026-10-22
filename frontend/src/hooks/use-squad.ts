import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { SquadPlayer } from '@/types/api';

/** Effectif complet de l'OL (nom, poste, numéro) : nomme la fiche d'un joueur sans minute (L210). */
export function useSquad() {
  return useQuery({
    queryKey: ['players', 'squad'],
    queryFn: ({ signal }) => apiGet<SquadPlayer[]>('/players/squad', signal),
    staleTime: 60 * 60 * 1000,
  });
}
