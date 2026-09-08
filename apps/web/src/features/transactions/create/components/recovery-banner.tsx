import { Button } from '@/components/ui/button';

type RecoveryBannerProps = {
  isPending: boolean;
  onNewAttempt(): void;
  onReplay(): void;
};

export function RecoveryBanner({ isPending, onNewAttempt, onReplay }: RecoveryBannerProps) {
  return (
    <section
      aria-label="Tentativa anterior com resultado incerto"
      className="rounded-xl border border-error-container bg-error-container/20 p-4"
    >
      <p className="mb-1 text-[13px] font-semibold text-error">Resultado desconhecido</p>
      <p className="mb-3 text-[13px] text-on-surface-variant">
        A confirmação da tentativa anterior não foi recebida. Os dados foram preservados. Retome
        para verificar se a transação já foi criada.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-9 rounded-full px-4"
          disabled={isPending}
          onClick={onReplay}
          type="button"
        >
          {isPending ? 'Enviando...' : 'Retomar tentativa'}
        </Button>
        <Button
          className="h-9 rounded-full px-4"
          disabled={isPending}
          onClick={onNewAttempt}
          type="button"
          variant="outlined"
        >
          Nova tentativa
        </Button>
      </div>
    </section>
  );
}
