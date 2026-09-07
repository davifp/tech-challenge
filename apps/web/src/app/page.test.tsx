import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock('next/navigation', () => ({ redirect }));

describe('web/RootPage', () => {
  it('redireciona a entrada para a listagem de transações', async () => {
    const { default: RootPage } = await import('./page');
    expect(() => RootPage()).toThrow('REDIRECT:/transactions');
    expect(redirect).toHaveBeenCalledWith('/transactions');
  });
});
