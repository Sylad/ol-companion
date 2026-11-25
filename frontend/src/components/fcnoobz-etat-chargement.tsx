import { Loader2 } from 'lucide-react';
import { RetryMessage } from '@/components/retry-message';

const GREEN = '#84cc16';

interface Props {
  loading: boolean;
  messageChargement: string;
  messageErreur: string;
  onRetry: () => void;
}

/**
 * Chargement ou erreur d'une page FC Noobz qui lit un fichier statique (Jeux vidéo, Mes carrières).
 * L121 (revue UX M1, WCAG 2.4.3) : l'erreur passe par `RetryMessage`, comme le reste de l'app — après « Réessayer »
 * le focus va sur <main> pendant la relecture, puis revient sur le bouton si l'erreur revient ; jamais sur <body>.
 * Mouvement réduit (WCAG 2.3.3) : l'indicateur ne tourne que si l'utilisateur n'a pas demandé moins d'animation.
 */
export function FcNoobzEtatChargement({ loading, messageChargement, messageErreur, onRetry }: Props) {
  return (
    <section aria-busy={loading}>
      {loading ? (
        <div role="status" className="flex flex-col items-center gap-4 py-20 text-center text-fg-muted">
          <Loader2 data-testid="indicateur-chargement" className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
          <p data-testid="message-chargement" className="text-sm">
            {messageChargement}
          </p>
        </div>
      ) : (
        <RetryMessage
          message={messageErreur}
          onRetry={onRetry}
          messageTestId="message-erreur"
          buttonTestId="bouton-reessayer"
          className="flex flex-col items-center gap-4 py-20 text-center"
          buttonStyle={{ borderColor: GREEN, background: 'rgba(132, 204, 22, 0.1)' }}
        />
      )}
    </section>
  );
}
