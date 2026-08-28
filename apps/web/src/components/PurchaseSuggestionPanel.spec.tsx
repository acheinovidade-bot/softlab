import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { PurchaseSuggestionPanel } from './PurchaseSuggestionPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);
const emptyHistory = { items: [], total: 0, page: 1, pageSize: 20 };
const detail = {
  id: 'suggestion',
  forecastDays: 30,
  status: 'calculated' as const,
  calculatedAt: '2026-08-26T12:00:00.000Z',
  itemCount: 1,
  totalSuggestedItems: 1,
  parameters: { historyDays: 90, recentDays: 30, calculationVersion: 'v1' },
  items: [
    {
      id: 'item',
      productId: 'product',
      product: { code: 'P1', description: 'Produto inteligente' },
      averageDailySales: '1',
      availableStock: '20',
      safetyStock: '10',
      pendingPurchase: '8',
      suggestedQuantity: '42',
      explanation: {
        forecastDemand: '45',
        leadTimeDemand: '15',
        inTransitPurchase: '3',
        minimumStock: '10',
        maximumStock: '100',
        targetStock: '70',
        daysOfCoverage: '20',
        leadDays: 10,
        trendFactor: 1.5,
        seasonalityFactor: 1,
        demandFactor: 1.5,
        reason: 'Reposição necessária.',
      },
    },
  ],
};

describe('PurchaseSuggestionPanel', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(
      (path) => Promise.resolve(path.endsWith('/calculate') ? detail : emptyHistory) as never,
    );
  });

  it('calculates and explains an intelligent purchase suggestion', async () => {
    render(<PurchaseSuggestionPanel canCalculate />);
    expect(await screen.findByText('Nenhum cálculo realizado.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Calcular sugestão' }));
    expect(await screen.findByText('Produto inteligente')).toBeInTheDocument();
    expect(screen.getByText('T 1.50×')).toBeInTheDocument();
    expect(screen.getByText('S 1.00×')).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith(
      '/purchases/suggestions/calculate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ forecastDays: 30, historyDays: 90 }),
      }),
    );
  });

  it('keeps prior calculations read-only without calculation permission', async () => {
    render(<PurchaseSuggestionPanel canCalculate={false} />);
    expect(screen.queryByRole('button', { name: 'Calcular sugestão' })).not.toBeInTheDocument();
    expect(await screen.findByText('Nenhum cálculo realizado.')).toBeInTheDocument();
  });
});
