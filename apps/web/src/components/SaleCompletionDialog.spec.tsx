import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { SaleCompletionDialog, type SaleReceipt } from './SaleCompletionDialog';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') },
}));

const receipt: SaleReceipt = {
  orderId: 'order-1',
  orderNumber: 'PED-1',
  saleId: 'sale-1',
  saleNumber: 'VEN-1',
  total: '32.90',
  itemCount: 1,
  paymentCount: 1,
  soldAt: '2026-08-29T12:00:00.000Z',
  issuer: {
    tradeName: 'Mercado Modelo',
    legalName: 'Comercial Modelo do Brasil Ltda.',
    taxId: '01027058000191',
  },
  lines: [
    {
      code: 'CAF-001',
      description: 'Café especial',
      unit: 'UN',
      quantity: 1,
      unitPrice: 32.9,
      total: 32.9,
    },
  ],
  payments: [{ name: 'Dinheiro', amount: 32.9 }],
};

describe('SaleCompletionDialog', () => {
  const write = vi.fn();
  const close = vi.fn();

  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    write.mockReset();
    close.mockReset();
    vi.spyOn(window, 'open').mockReturnValue({ document: { write, close } } as unknown as Window);
  });

  afterEach(() => vi.restoreAllMocks());

  it('prints company data and a QR Code on the F9 order receipt', async () => {
    const onNext = vi.fn();
    render(<SaleCompletionDialog receipt={receipt} onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: /Imprimir pedido/ }));

    await waitFor(() => expect(write).toHaveBeenCalled());
    const html = String(write.mock.calls[0]?.[0]);
    expect(html).toContain('Mercado Modelo');
    expect(html).toContain('Comercial Modelo do Brasil Ltda.');
    expect(html).toContain('CNPJ 01.027.058/0001-91');
    expect(html.indexOf('Mercado Modelo')).toBeLessThan(html.indexOf('Comercial Modelo'));
    expect(html).toContain('PEDIDO DE VENDA');
    expect(html).toContain('QR Code do pedido');
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('uses the same company header on the F8 DANFE NFC-e', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      accessKey: '23260800000000000191650010000000011000000010',
      protocol: '323260000000001',
      series: '1',
      number: '1',
      issuedAt: '2026-08-29T12:00:00.000Z',
      qrCodeUrl: 'https://sefaz.example/nfce/1',
      total: '32.90',
    } as never);
    const onNext = vi.fn();
    render(<SaleCompletionDialog receipt={receipt} onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: /Emitir NFC-e/ }));

    await waitFor(() => expect(write).toHaveBeenCalled());
    const html = String(write.mock.calls[0]?.[0]);
    expect(html).toContain('Mercado Modelo');
    expect(html).toContain('Comercial Modelo do Brasil Ltda.');
    expect(html).toContain('CNPJ 01.027.058/0001-91');
    expect(html).toContain('DANFE NFC-e');
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('returns to a new sale when the operator presses Escape', () => {
    const onNext = vi.fn();
    render(<SaleCompletionDialog receipt={receipt} onNext={onNext} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onNext).toHaveBeenCalledOnce();
  });
});
