type PollErrorBannerProps = {
  errorMessage: string;
  onRetry(): void;
};

export function PollErrorBanner({ errorMessage, onRetry }: PollErrorBannerProps) {
  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-container bg-error-container/20 px-4 py-3"
      role="status"
    >
      <div>
        <p className="text-[13px] font-semibold text-error">Falha na atualização automática</p>
        <p className="text-[13px] text-on-surface-variant">{errorMessage}</p>
      </div>
      <button
        className="shrink-0 text-[13px] font-semibold text-primary hover:underline"
        onClick={onRetry}
        type="button"
      >
        Tentar novamente
      </button>
    </div>
  );
}
