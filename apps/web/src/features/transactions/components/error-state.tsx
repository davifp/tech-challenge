import { useId } from 'react';

type ErrorStateProps = {
  description: string;
  onRetry(): void;
  title: string;
};

export function ErrorState({ description, onRetry, title }: ErrorStateProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col items-start gap-3 rounded-xl border border-error-container bg-surface-container-lowest p-8 shadow-soft"
      role="alert"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-error">
        Falha na consulta
      </p>
      <h2 className="text-[18px] font-semibold text-on-surface" id={titleId}>
        {title}
      </h2>
      <p className="max-w-lg text-[14px] leading-6 text-on-surface-variant">{description}</p>
      <button
        className="inline-flex h-11 items-center rounded-full bg-primary-container px-5 text-[13px] font-semibold text-on-primary transition-colors hover:bg-primary"
        onClick={onRetry}
        type="button"
      >
        Tentar novamente
      </button>
    </section>
  );
}
