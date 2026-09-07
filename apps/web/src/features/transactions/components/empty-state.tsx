import { useId, type ReactNode } from 'react';

type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-surface-container-high bg-surface-container-lowest p-8 text-left shadow-soft"
    >
      <h2 className="text-[18px] font-semibold text-on-surface" id={titleId}>
        {title}
      </h2>
      <p className="max-w-lg text-[14px] leading-6 text-on-surface-variant">{description}</p>
      {action}
    </section>
  );
}
