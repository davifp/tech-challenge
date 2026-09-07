import { useId, type ReactNode } from 'react';

type FeedbackTone = 'error' | 'info' | 'success';

type FeedbackMessageProps = {
  children: ReactNode;
  title: string;
  tone?: FeedbackTone;
};

const TONE_STYLES: Record<FeedbackTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
};

export function FeedbackMessage({ children, title, tone = 'info' }: FeedbackMessageProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`rounded-xl border p-4 ${TONE_STYLES[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <h2 className="font-bold" id={titleId}>
        {title}
      </h2>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </section>
  );
}
