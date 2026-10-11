interface RetryMessageProps {
  message: string;
  onRetry: () => void;
  messageTestId: string;
  buttonTestId: string;
  className?: string;
}

/** Message d'erreur d'un bloc de l'accueil + « Réessayer » (L85). */
export function RetryMessage({ message, onRetry, messageTestId, buttonTestId, className }: RetryMessageProps) {
  return (
    <div className={className ?? 'flex flex-col items-center gap-3 text-center'}>
      <p data-testid={messageTestId} role="alert" className="text-sm text-ol-red-bright">
        {message}
      </p>
      <button
        type="button"
        data-testid={buttonTestId}
        onClick={onRetry}
        className="min-h-[44px] rounded-md border border-ol-blue-bright bg-ol-blue-bright/10 px-5 text-sm font-semibold text-fg-bright"
      >
        Réessayer
      </button>
    </div>
  );
}
