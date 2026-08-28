import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { PosSettingsPanel } from './PosSettingsPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('PosSettingsPanel', () => {
  it('saves seller, stock location and optional customer as branch defaults', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        customers: [{ id: 'customer-1', name: 'Cliente padrão' }],
        sellers: [{ id: 'seller-1', name: 'Vendedor padrão' }],
        locations: [{ id: 'location-1', code: 'LOJA', name: 'Estoque da loja' }],
        settings: {
          defaultCustomerId: null,
          defaultSellerId: 'seller-1',
          defaultLocationId: 'location-1',
        },
      } as never)
      .mockResolvedValueOnce({
        defaultCustomerId: null,
        defaultSellerId: 'seller-1',
        defaultLocationId: 'location-1',
      } as never);

    render(<PosSettingsPanel canManage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar configurações do PDV' }));

    expect(await screen.findByText('Padrões do PDV salvos para esta filial.')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenLastCalledWith('/sales/pos/settings', {
      method: 'PUT',
      body: JSON.stringify({
        defaultCustomerId: null,
        defaultSellerId: 'seller-1',
        defaultLocationId: 'location-1',
      }),
    });
  });
});
