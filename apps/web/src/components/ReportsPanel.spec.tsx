import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { ReportsPanel } from './ReportsPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

it('renders the most-used operational reports', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    metrics: {
      todayGross: '100',
      monthGross: '2000',
      averageTicket: '50',
      pendingOrders: 3,
      openReceivables: '800',
      lowStockProducts: 4,
    },
    topProducts: [],
    noSalesProducts: [],
    topCreditCustomers: [],
  } as never);
  render(<ReportsPanel mode="summary" />);
  expect(await screen.findByText('Vendas por período')).toBeInTheDocument();
  expect(screen.getByText('Fechamento e fita de caixa')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
});
