import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { CustomerStatementPanel } from './CustomerStatementPanel';
vi.mock('../api', () => ({ apiRequest: vi.fn() }));
describe('CustomerStatementPanel', () => {
  it('shows products, coupon debt and partial payment action', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      customer: { id: 'c1', name: 'Maria', creditLimit: '500' },
      period: { from: '2026-08-01', to: '2026-08-31' },
      totalPurchased: '80',
      totalPaid: '20',
      totalDue: '60',
      coupons: [
        {
          saleId: 's1',
          saleNumber: 'VEN-001',
          soldAt: '2026-08-20T10:00:00Z',
          total: '80',
          creditAmount: '80',
          amountPaid: '20',
          amountDue: '60',
          receivableId: 'r1',
          items: [{ description: 'Café especial', quantity: '2', unitPrice: '40', total: '80' }],
        },
      ],
    } as never);
    render(
      <CustomerStatementPanel
        customerId="c1"
        paymentMethods={[{ id: 'pix', name: 'PIX', type: 'pix' }]}
        canReceive
        onClose={() => undefined}
      />,
    );
    expect(await screen.findByText(/Maria · Limite.*500,00/)).toBeInTheDocument();
    expect(screen.getByText(/Café especial/)).toBeInTheDocument();
    expect(screen.getByText('VEN-001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receber parcial' })).toBeInTheDocument();
  });
});
