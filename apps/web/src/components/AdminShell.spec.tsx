import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { demoUser } from '../demo';
import { AdminShell } from './AdminShell';

vi.mock('./ProductsPanel', () => ({
  ProductsPanel: () => <div>Conteúdo de produtos</div>,
}));

describe('AdminShell', () => {
  it('organiza os botões dos módulos dentro de menus funcionais', () => {
    render(<AdminShell user={demoUser} onLogout={vi.fn()} initialSection="products" />);

    const navigation = screen.getByRole('navigation', { name: 'Módulos do sistema' });
    expect(within(navigation).getByRole('button', { name: 'Pessoas' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(navigation).getByRole('button', { name: 'Logística' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(navigation).getByRole('button', { name: 'Produtos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(within(navigation).getByRole('button', { name: 'Frente de Caixa' }));
    expect(within(navigation).getByRole('button', { name: 'PDV' })).toBeInTheDocument();
    expect(within(navigation).queryByRole('button', { name: 'Produtos' })).not.toBeInTheDocument();
  });
});
