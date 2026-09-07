export const PAGE_SIZE = 20;
export const FIRST_PAGE = 1;
const MAX_PAGE_BUTTONS = 4;

export function totalPages(total: number): number {
  if (total <= 0) return FIRST_PAGE;
  return Math.max(FIRST_PAGE, Math.ceil(total / PAGE_SIZE));
}

export function pageRange(page: number, total: number): { start: number; end: number } {
  if (total === 0) return { start: 0, end: 0 };
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return { start, end };
}

export function pageWindow(page: number, pages: number): number[] {
  if (pages <= MAX_PAGE_BUTTONS) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }
  const start = Math.min(Math.max(FIRST_PAGE, page - 1), pages - MAX_PAGE_BUTTONS + 1);
  return Array.from({ length: MAX_PAGE_BUTTONS }, (_, index) => start + index);
}
