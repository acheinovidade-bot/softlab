import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { CashOperationsPanel } from './CashOperationsPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('CashOperationsPanel', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it('shows sales, fees and net settlement in operations mode', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      totals: { sales: 1, gross: '100.00', fees: '2.89', net: '97.11' },
      records: [
        {
          id: 'sale-1',
          number: 'PDV-001',
          soldAt: '2026-08-29T12:00:00.000Z',
          status: 'completed',
          origin: 'pos',
          customer: 'Ana Martins',
          operator: 'Marina Costa',
          total: '100.00',
          feeAmount: '2.89',
          netAmount: '97.11',
          payments: [{ method: 'Cartão de crédito', amount: '100.00', installments: 2 }],
          fiscal: { type: 'NFC-e', status: 'authorized', number: '1' },
        },
      ],
    } as never);

    render(<CashOperationsPanel mode="operations" />);
    expect(await screen.findByText('PDV-001')).toBeInTheDocument();
    expect(screen.getByText('Taxa R$ 2,89')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 97,11')).toHaveLength(2);
  });

  it('shows chronological cash entries in tape mode', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      totals: { entries: 1, inflows: '0.00', outflows: '80.00', balance: '-80.00' },
      entries: [
        {
          id: 'entry-1',
          occurredAt: '2026-08-29T12:00:00.000Z',
          type: 'withdrawal',
          description: 'Sangria para cofre',
          amount: '80.00',
          direction: 'out',
          method: 'Dinheiro',
          register: 'CAIXA 01',
          operator: 'Marina Costa',
        },
      ],
    } as never);

    render(<CashOperationsPanel mode="tape" />);
    expect(await screen.findByText('Sangria para cofre')).toBeInTheDocument();
    expect(screen.getByText('− R$ 80,00')).toHaveClass('cash-out');
  });
});
