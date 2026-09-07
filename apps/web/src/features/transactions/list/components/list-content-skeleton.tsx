const SKELETON_ROWS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'] as const;

export function ListContentSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="rounded-xl border border-surface-container-high/60 bg-surface-container-lowest p-4 shadow-soft"
      role="status"
    >
      <span className="sr-only">Carregando transações…</span>
      <div className="flex flex-col gap-3">
        {SKELETON_ROWS.map((key) => (
          <div
            className="h-14 animate-pulse rounded-lg bg-surface-container-low motion-reduce:animate-none"
            key={key}
          />
        ))}
      </div>
    </div>
  );
}
