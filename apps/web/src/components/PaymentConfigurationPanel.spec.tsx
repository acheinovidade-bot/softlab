import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { PaymentConfigurationPanel } from './PaymentConfigurationPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('PaymentConfigurationPanel', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue({
      cardOperators: [
        {
          id: 'operator-1',
          code: 'REDE',
          name: 'Rede',
          taxId: null,
          debitRate: '1.49',
          creditRate: '2.89',
          installmentRate: '0.35',
          settlementDays: 30,
          active: true,
        },
      ],
      paymentMethods: [
        {
          id: 'method-1',
          code: 'CREDITO',
          name: 'Cartão de crédito',
          type: 'credit_card',
          fiscalCode: '03',
          cardOperatorId: 'operator-1',
          maxInstallments: 12,
          createsReceivable: true,
          active: true,
        },
      ],
    } as never);
  });

  it('shows operator rates and the net settlement preview', async () => {
    render(<PaymentConfigurationPanel mode="operators" canManage />);
    expect(await screen.findByText('Rede')).toBeInTheDocument();
    expect(screen.getByText('R$ 97,11')).toBeInTheDocument();
    expect(screen.getByText('D+30')).toBeInTheDocument();
  });

  it('links finalizers to operators and financial behavior', async () => {
    render(<PaymentConfigurationPanel mode="methods" canManage={false} />);
    expect(await screen.findByText('Cartão de crédito')).toBeInTheDocument();
    expect(screen.getByText('Gera recebível')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument();
  });
});
