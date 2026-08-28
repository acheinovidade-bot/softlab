import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { CashPanel } from './CashPanel';
vi.mock('../api', () => ({ apiRequest: vi.fn() }));
describe('CashPanel', () => {
  it('shows an open session and its three-column closing input', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      registers: [{ id: 'r1', code: 'CX-01', name: 'Caixa principal' }],
      paymentMethods: [{ id: 'm1', name: 'Dinheiro' }],
      sessions: [
        {
          id: 's1',
          register: { id: 'r1', code: 'CX-01', name: 'Caixa principal' },
          operatorId: 'u1',
          status: 'open',
          openingAmount: '100',
          openedAt: new Date().toISOString(),
          closedAt: null,
          totals: [{ paymentMethodId: 'm1', methodName: 'Dinheiro', amount: '150' }],
          movements: [],
        },
      ],
    } as never);
    render(<CashPanel canOperate canReopen />);
    expect(screen.getByRole('heading', { name: 'Caixa diário' })).toBeInTheDocument();
    expect(await screen.findByText('● EM OPERAÇÃO')).toBeInTheDocument();
    expect(screen.getByText(/Sistema/)).toHaveTextContent('Sistema R$ 150,00');
    expect(screen.getByRole('button', { name: 'Fechar e conferir' })).toBeInTheDocument();
  });
});
