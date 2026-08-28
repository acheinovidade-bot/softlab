import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { StockPanel } from './StockPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn((path: string) => Promise.resolve(path.startsWith('/stock/overview') ? { items: [{ id: 'product', code: 'P1', description: 'Produto em alerta', controlsLot: false, controlsExpiry: false, quantity: '1', reservedQuantity: '0', availableQuantity: '1', minimumStock: '2', status: 'low' }], total: 1, page: 1, pageSize: 20, summary: { out: 0, low: 1, ok: 0 } } : path === '/stock/lookups' ? { warehouses: [], locations: [], products: [], lots: [] } : path.startsWith('/stock/lots') ? { items: [{ id: 'lot', productId: 'product', lotNumber: 'L-01', manufacturedAt: null, expiresAt: '2026-09-05T00:00:00.000Z', productCode: 'P1', productDescription: 'Produto em alerta', quantity: '1', reservedQuantity: '0', availableQuantity: '1', status: '15' }], total: 1, page: 1, pageSize: 20, summary: { expired: 0, within15: 1, within30: 0, within60: 0, within90: 0 } } : { items: [], total: 0, page: 1, pageSize: 20 })) }));

describe('StockPanel', () => {
  it('renders visual stock alerts and respects adjustment permission', async () => {
    render(<StockPanel canAdjust={false} canReadMovements />); expect(await screen.findByText('Produto em alerta')).toBeInTheDocument(); expect(screen.getByText('P1 · Produto em alerta')).toBeInTheDocument(); expect(screen.getByText('Baixo')).toBeInTheDocument(); expect(screen.getByText('L-01')).toBeInTheDocument(); expect(screen.getAllByText('Até 15 dias')).toHaveLength(2); expect(screen.queryByText('+ Novo')).not.toBeInTheDocument(); expect(screen.getByText('Últimas movimentações')).toBeInTheDocument();
  });
});
