import Link from 'next/link';

type DetailLoadingSkeletonProps = {
  backHref: string;
};

export function DetailLoadingSkeleton({ backHref }: DetailLoadingSkeletonProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          href={backHref}
        >
          ← Voltar
        </Link>
        <div className="h-6 w-40 animate-pulse rounded-md bg-surface-container-low motion-reduce:animate-none" />
      </div>
      <div
        aria-busy="true"
        aria-live="polite"
        className="rounded-xl border border-surface-container-high/60 bg-surface-container-lowest p-6 shadow-soft"
        role="status"
      >
        <span className="sr-only">Carregando detalhe da transação…</span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'] as const).map((key) => (
            <div className="flex flex-col gap-2" key={key}>
              <div className="h-3 w-16 animate-pulse rounded bg-surface-container-low motion-reduce:animate-none" />
              <div className="h-5 w-full animate-pulse rounded bg-surface-container-low motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
