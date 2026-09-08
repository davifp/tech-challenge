'use client';

import { useEffect, useRef, useState } from 'react';

import { IconCheck, IconCopy } from '@/components/ui/icons';

type CopyIdentifierButtonProps = {
  label: string;
  value: string;
};

const FEEDBACK_TIMEOUT_MS = 1600;
type CopyState = 'idle' | 'copied' | 'failed';

export function CopyIdentifierButton({ label, value }: CopyIdentifierButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copied = copyState === 'copied';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopyState('idle'), FEEDBACK_TIMEOUT_MS);
  }

  return (
    <>
      <button
        aria-label={label}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
        onClick={handleCopy}
        type="button"
      >
        {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
      </button>
      <span aria-live="polite" className="sr-only" role="status">
        {copyState === 'copied' ? 'Identificador copiado.' : null}
        {copyState === 'failed' ? 'Não foi possível copiar o identificador.' : null}
      </span>
    </>
  );
}
