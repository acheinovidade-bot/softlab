import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { QuotationPanel } from './QuotationPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);
const suggestion = {
  id: '018f4f12-2222-7222-8222-555555555555',
  forecastDays: 30,
  status: 'calculated' as const,
  calculatedAt: '2026-08-27T12:00:00.000Z',
  itemCount: 1,
  totalSuggestedItems: 1,
};
const detail = {
  id: 'quotation',
  number: 'COT-1',
  status: 'open' as const,
  responseDeadline: '2026-09-03T23:59:59.000Z',
  createdAt: '2026-08-27T12:00:00.000Z',
  supplierCount: 1,
  responseCount: 0,
  itemCount: 1,
  purchaseSuggestionId: suggestion.id,
  totalPotentialSavings: '0',
  items: [
    {
      id: 'item',
      productId: 'product',
      product: { code: 'P1', description: 'Produto' },
      quantity: '5',
      offers: [],
      lowestPrice: null,
      potentialSavings: '0',
    },
  ],
  suppliers: [
    {
      id: 'invite',
      supplierId: 'supplier',
      supplier: { legalName: 'Fornecedor 1', tradeName: null, phone: '5585999999999' },
      status: 'invited',
      sentAt: null,
      respondedAt: null,
    },
  ],
  invitations: [
    {
      quotationSupplierId: 'invite',
      supplierId: 'supplier',
      publicPath: `/quotation/${'a'.repeat(43)}`,
    },
  ],
};

describe('QuotationPanel', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(
      (path) =>
        Promise.resolve(
          path === '/purchases/suggestions'
            ? { items: [suggestion], total: 1, page: 1, pageSize: 20 }
            : path === '/purchases/quotations/from-suggestion'
              ? detail
              : { items: [], total: 0, page: 1, pageSize: 20 },
        ) as never,
    );
  });
  it('creates a quotation and exposes secure assisted sharing', async () => {
    render(<QuotationPanel canManage />);
    expect(await screen.findByText(/30 dias · 1 itens/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Criar cotação' }));
    expect(await screen.findByText('Fornecedor 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compartilhar no WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/5585999999999'),
    );
    expect(mockedApi).toHaveBeenCalledWith(
      '/purchases/quotations/from-suggestion',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('hides quotation creation without management permission', async () => {
    render(<QuotationPanel canManage={false} />);
    expect(screen.queryByRole('button', { name: 'Criar cotação' })).not.toBeInTheDocument();
    expect(await screen.findByText('Nenhuma cotação criada.')).toBeInTheDocument();
  });
});
