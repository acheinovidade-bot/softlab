import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { PosPanel } from './PosPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('PosPanel', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    localStorage.clear();
  });
  it('searches a product and adds it to the checkout cart', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      customers: [],
      sellers: [{ id: 'seller-1', name: 'Operador' }],
      paymentMethods: [{ id: 'cash-1', code: 'DIN', name: 'Dinheiro', type: 'cash' }],
      locations: [{ id: 'location-1', code: 'LOJA', name: 'Loja' }],
      products: [
        {
          id: 'product-1',
          code: 'CAFE-1',
          barcode: '789100000001',
          description: 'Café especial',
          openPrice: false,
          controlsLot: false,
          salePrice: '18.90',
          availableQuantity: '12',
        },
      ],
    } as never);

    render(<PosPanel canDiscount={false} />);
    expect(screen.getByRole('heading', { name: 'Venda rápida' })).toBeInTheDocument();
    const search = await screen.findByPlaceholderText('Código, código de barras ou descrição');
    fireEvent.change(search, { target: { value: '789100000001' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByText('Café especial')).toBeInTheDocument();
    expect(screen.getAllByText(/18,90/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'F9 · Finalizar venda' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Trabalhar online' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Trabalhar offline' }));
    expect(localStorage.getItem('erp:pos-operation-mode')).toBe('offline');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Trabalhar offline' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });
  it('requires a valid lot and seller when configured per sale', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      settings: {
        defaultCustomerId: null,
        defaultSellerId: null,
        defaultLocationId: 'location-1',
        sellerMode: 'per_sale',
      },
      customers: [],
      sellers: [{ id: 'seller-1', name: 'Marina Costa' }],
      paymentMethods: [{ id: 'cash-1', code: 'DIN', name: 'Dinheiro', type: 'cash' }],
      locations: [{ id: 'location-1', code: 'EXP', name: 'Expedição' }],
      products: [
        {
          id: 'product-1',
          code: 'LOTE-1',
          barcode: '789100000002',
          description: 'Produto rastreado',
          openPrice: false,
          controlsLot: true,
          controlsExpiry: true,
          selectLotAtPos: true,
          salePrice: '20',
          availableQuantity: '5',
          lots: [
            {
              id: 'lot-1',
              lotNumber: 'L-2099',
              expiresAt: '2099-12-31T00:00:00.000Z',
              availableQuantity: '5',
            },
          ],
        },
      ],
    } as never);
    render(<PosPanel canDiscount={false} />);
    const search = await screen.findByPlaceholderText('Código, código de barras ou descrição');
    fireEvent.change(search, { target: { value: 'LOTE-1' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /Lote L-2099/ }));
    expect(screen.getByText(/Lote L-2099/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Vendedor desta venda' })).toBeInTheDocument();
  });
});
