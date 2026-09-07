import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CopyIdentifierButton } from './copy-identifier-button';

const IDENTIFIER = '0199f9d2-1a2b-7c8d-9e0f-1234567890ab';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('web/CopyIdentifierButton', () => {
  it('copia o identificador e anuncia a confirmação', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<CopyIdentifierButton label="Copiar identificador" value={IDENTIFIER} />);
    await user.click(screen.getByRole('button', { name: 'Copiar identificador' }));
    expect(writeText).toHaveBeenCalledWith(IDENTIFIER);
    expect(screen.getByRole('status')).toHaveTextContent('Identificador copiado.');
  });

  it('anuncia quando o navegador rejeita a cópia', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard indisponível'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<CopyIdentifierButton label="Copiar identificador" value={IDENTIFIER} />);
    await user.click(screen.getByRole('button', { name: 'Copiar identificador' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Não foi possível copiar o identificador.',
    );
  });
});
