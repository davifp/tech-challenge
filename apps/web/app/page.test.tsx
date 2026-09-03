import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DashboardPage from './page';

describe('web/DashboardPage', () => {
  it('renderiza o heading principal', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });
});
