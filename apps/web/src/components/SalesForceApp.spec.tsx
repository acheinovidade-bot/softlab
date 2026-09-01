import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { SalesForceApp } from './SalesForceApp';

vi.mock('../api', () => ({
  apiRequest: vi.fn(),
  refreshSession: vi.fn().mockResolvedValue(null),
  setAccessToken: vi.fn(),
}));

describe('SalesForceApp', () => {
  it('renders the mobile order flow and customer tools', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      customers: [{ id: 'c1', name: 'Mercado Central' }],
      sellers: [],
      paymentMethods: [],
      products: [
        { id: 'p1', code: 'P1', description: 'Produto recorrente', price: { salePrice: '25' } },
      ],
    } as never);
    render(<SalesForceApp canCreateCustomer canInvoice offlineScope="company:branch:user" />);
    expect(screen.getByRole('heading', { name: 'Força de Vendas' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Produto recorrente/ }));
    expect(screen.getAllByText('R$ 25,00')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Cadastrar' })).toBeInTheDocument();
  });
});
