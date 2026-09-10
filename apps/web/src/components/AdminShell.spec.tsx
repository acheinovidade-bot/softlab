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
    expect(screen.getByRole('searchbox', { name: 'Buscar no menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDV' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'Cadastros' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(navigation).getByRole('button', { name: 'Estoque e Entregas' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(navigation).getByRole('button', { name: 'Produtos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(within(navigation).getByRole('button', { name: 'Caixa e PDV' }));
    expect(within(navigation).getByRole('button', { name: 'PDV' })).toBeInTheDocument();
    expect(within(navigation).queryByRole('button', { name: 'Produtos' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no menu' }), { target: { value: 'cliente' } });
    expect(within(navigation).getByRole('button', { name: 'Clientes' })).toBeInTheDocument();
    expect(within(navigation).queryByRole('button', { name: 'PDV' })).not.toBeInTheDocument();
  });
});
