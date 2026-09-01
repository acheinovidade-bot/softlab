import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { DashboardPanel } from './DashboardPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

it('renders business indicators and daily comparison', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    updatedAt: '2026-08-29T12:00:00.000Z',
    metrics: {
      todayGross: '1000',
      todaySales: 10,
      monthGross: '20000',
      monthSales: 200,
      averageTicket: '100',
      pendingOrders: 4,
      openReceivables: '3500',
      lowStockProducts: 6,
    },
    daily: [{ label: '29/08', value: '1000', count: 10 }],
    monthly: [{ label: 'ago', value: '20000', count: 200 }],
    topProducts: [],
    noSalesProducts: [],
    topCreditCustomers: [],
  } as never);
  render(<DashboardPanel onOpenOrders={vi.fn()} />);
  expect(await screen.findByText('R$ 20.000,00')).toBeInTheDocument();
  expect(screen.getByLabelText('Gráfico comparativo daily')).toBeInTheDocument();
  expect(screen.getByText('4 pedidos em andamento')).toBeInTheDocument();
});
