import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { FoodServicePanel } from './FoodServicePanel';
vi.mock('../api', () => ({ apiRequest: vi.fn() }));
describe('FoodServicePanel', () => {
  it('renders the table map with several tabs per table', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      tables: [{ id: 't1', code: 'M01', name: 'Mesa 1', capacity: 4, status: 'occupied' }],
      waiters: [],
      customers: [],
      products: [],
      tabs: [
        {
          id: 'c1',
          tableId: 't1',
          number: 'CMD-1',
          channel: 'table',
          waiterId: null,
          guests: 2,
          openedAt: new Date().toISOString(),
          itemCount: 3,
          total: '45',
        },
        {
          id: 'c2',
          tableId: 't1',
          number: 'CMD-2',
          channel: 'table',
          waiterId: null,
          guests: 1,
          openedAt: new Date().toISOString(),
          itemCount: 1,
          total: '12',
        },
      ],
    } as never);
    render(<FoodServicePanel canManage canOperate />);
    expect(screen.getByRole('heading', { name: 'Salão e comandas' })).toBeInTheDocument();
    const table = await screen.findByRole('button', { name: /Mesa 1/ });
    fireEvent.click(table);
    expect(screen.getByRole('button', { name: /Comanda 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RESUMO' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delivery' }));
    expect(screen.getAllByRole('heading', { name: 'Delivery' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: '+ Novo atendimento' })).toBeInTheDocument();
  });
});
