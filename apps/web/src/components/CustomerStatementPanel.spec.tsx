import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { CustomerStatementPanel } from './CustomerStatementPanel';
vi.mock('../api', () => ({ apiRequest: vi.fn() }));
describe('CustomerStatementPanel', () => {
  it('shows products, coupon debt and partial payment action', async () => {
    const write = vi.fn();
    const close = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ document: { write, close } } as never);
    vi.mocked(apiRequest).mockResolvedValue({
      customer: { id: 'c1', name: 'Maria', creditLimit: '500' },
      period: { from: '2026-08-01', to: '2026-08-31' },
      totalPurchased: '80',
      totalPaid: '20',
      totalDue: '60',
      lastPayment: {
        settledAt: '2026-08-25T14:30:00Z',
        amount: '20',
        account: 'Crediário VEN-001',
        accountStatus: 'partial',
      },
      settlements: [
        {
          id: 'st1',
          settledAt: '2026-08-25T14:30:00Z',
          amount: '20',
          account: 'Crediário VEN-001',
          accountStatus: 'partial',
        },
      ],
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
        issuer={{
          tradeName: 'Mercado Modelo',
          legalName: 'Comercial Modelo Ltda.',
          taxId: '01027058000191',
        }}
        canReceive
        onClose={() => undefined}
      />,
    );
    expect(await screen.findByText(/Maria · Limite.*500,00/)).toBeInTheDocument();
    expect(screen.getByText(/Café especial/)).toBeInTheDocument();
    expect(screen.getByText('VEN-001')).toBeInTheDocument();
    expect(screen.getAllByText(/25\/08\/2026/).length).toBeGreaterThan(0);
    expect(screen.getByText('Pagamentos e contas baixadas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receber parcial' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '' }), { target: { value: 'pix' } });
    fireEvent.change(screen.getByLabelText('Pagamento de VEN-001'), {
      target: { value: '30.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Receber parcial' }));
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith(expect.stringContaining('RECIBO DE PAGAMENTO')),
    );
    expect(write).toHaveBeenCalledWith(expect.stringContaining('COMPRA BAIXADA'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('VEN-001'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('VALOR PAGO'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('30,00'));
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir extrato 80 mm' }));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('EXTRATO DE CREDIÁRIO'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Café especial'));
    expect(close).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Resumido · somente valores' }));
    expect(screen.queryByText(/Café especial/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir extrato 80 mm' })).toBeInTheDocument();
    open.mockRestore();
  });
});
