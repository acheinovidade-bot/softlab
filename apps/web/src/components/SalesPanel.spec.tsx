import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { SalesPanel } from './SalesPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));
describe('SalesPanel', () => {
  it('renders quotes and orders while respecting management permission', async () => {
    vi.mocked(apiRequest).mockImplementation(
      (path) =>
        Promise.resolve(
          path === '/sales/lookups'
            ? {
                customers: [],
                sellers: [],
                paymentMethods: [],
                products: [],
                locations: [],
                lots: [],
              }
            : { items: [], total: 0, page: 1, pageSize: 20 },
        ) as never,
    );
    render(<SalesPanel canManage={false} canDiscount={false} />);
    expect(screen.getByRole('heading', { name: 'Pedidos de venda' })).toBeInTheDocument();
    expect(await screen.findByText('Nenhum pedido.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Orçamentos/ }));
    expect(screen.getByText('Nenhum orçamento.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lançar novo pedido/ })).not.toBeInTheDocument();
  });
});
