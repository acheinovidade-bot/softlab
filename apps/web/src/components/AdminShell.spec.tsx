import { render, screen, within } from '@testing-library/react';
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
    expect(within(navigation).getByRole('heading', { name: 'Operação' })).toBeInTheDocument();
    expect(within(navigation).getByRole('heading', { name: 'Cadastros' })).toBeInTheDocument();
    expect(
      within(navigation).getByRole('heading', { name: 'Estoque e compras' }),
    ).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'PDV' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'Produtos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
