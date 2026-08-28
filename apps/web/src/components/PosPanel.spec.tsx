import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { PosPanel } from './PosPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('PosPanel', () => {
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
  });
});
