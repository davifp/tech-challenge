import { useId } from 'react';

import { Button } from '@/components/ui/button';

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
      <Button className="h-11 rounded-full px-5" onClick={onRetry} type="button">
        Tentar novamente
      </Button>
    </section>
  );
}
