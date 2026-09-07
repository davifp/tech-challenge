import { FIRST_PAGE, pageRange, pageWindow, totalPages } from '../pagination';

type PaginationBarProps = {
  page: number;
  total: number;
  onPageChange(page: number): void;
};

export function PaginationBar({ page, total, onPageChange }: PaginationBarProps) {
  const pages = totalPages(total);
  const { start, end } = pageRange(page, total);
  const canGoPrevious = page > FIRST_PAGE;
  const canGoNext = page < pages;
  const windowPages = pageWindow(page, pages);
  return (
    <nav
      aria-label="Paginação de transações"
      className="flex flex-col items-center justify-between gap-3 border-t border-surface-container-high/60 bg-surface-container-lowest px-4 py-4 sm:flex-row sm:px-6"
    >
      <p className="text-[13px] text-on-surface-variant" aria-live="polite">
        {total === 0 ? (
          'Nenhum registro encontrado'
        ) : (
          <>
            Mostrando{' '}
            <span className="font-semibold text-on-surface">
              {start} a {end}
            </span>{' '}
            de <span className="font-semibold text-on-surface">{total}</span> transações
          </>
        )}
      </p>
      <div className="flex items-center gap-1">
        <button
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-on-surface-variant transition-colors enabled:hover:bg-surface-container-low enabled:hover:text-on-surface disabled:opacity-40"
          disabled={!canGoPrevious}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          Anterior
        </button>
        <div className="flex items-center gap-1">
          {windowPages.map((pageNumber) => {
            const isCurrent = pageNumber === page;
            return (
              <button
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Ir para a página ${pageNumber}`}
                className={
                  isCurrent
                    ? 'flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-[13px] font-semibold text-on-primary'
                    : 'flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface'
                }
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                type="button"
              >
                {pageNumber}
              </button>
            );
          })}
        </div>
        <button
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-on-surface-variant transition-colors enabled:hover:bg-surface-container-low enabled:hover:text-on-surface disabled:opacity-40"
          disabled={!canGoNext}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Próxima
        </button>
      </div>
    </nav>
  );
}
