import { useEffect, useRef } from 'react';

// Focus (WCAG 2.4.3) : le bouton disparaît pendant le nouvel appel. Le focus passe alors sur <main>, puis
// revient sur « Réessayer » si l'erreur revient dans la minute ; sans retour d'erreur, la marque s'éteint.
let retryEn = 0;
const FENETRE_MS = 60_000;

interface RetryMessageProps {
  message: string;
  onRetry: () => void;
  messageTestId: string;
  buttonTestId: string;
  className?: string;
}

/** Message d'erreur d'un bloc de l'accueil + « Réessayer » (L85). */
export function RetryMessage({ message, onRetry, messageTestId, buttonTestId, className }: RetryMessageProps) {
  const boutonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (retryEn && Date.now() - retryEn < FENETRE_MS) boutonRef.current?.focus();
    retryEn = 0;
  }, []);
  return (
    <div className={className ?? 'flex flex-col items-center gap-3 text-center'}>
      <p data-testid={messageTestId} role="alert" className="text-sm text-ol-red-bright">
        {message}
      </p>
      <button
        ref={boutonRef}
        type="button"
        data-testid={buttonTestId}
        onClick={(e) => {
          const main = e.currentTarget.closest('main');
          if (main) {
            main.tabIndex = -1;
            main.focus({ preventScroll: true });
          }
          retryEn = Date.now();
          onRetry();
        }}
        className="min-h-[44px] rounded-md border border-ol-blue-bright bg-ol-blue-bright/10 px-5 text-sm font-semibold text-fg-bright"
      >
        Réessayer
      </button>
    </div>
  );
}
