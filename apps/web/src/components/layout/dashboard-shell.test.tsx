import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardShell } from './dashboard-shell';

describe('web/DashboardShell', () => {
  it('oferece regiões semânticas e atalho para o conteúdo', () => {
    render(
      <DashboardShell>
        <h1>Conteúdo de teste</h1>
      </DashboardShell>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo-principal');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Horário de Brasília');
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo principal' })).toHaveAttribute(
      'href',
      '#conteudo-principal',
    );
  });
});
