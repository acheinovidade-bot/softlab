import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { ProductionPanel } from './ProductionPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('ProductionPanel', () => {
  it('renders engineering and the complete production workflow', async () => {
    vi.mocked(apiRequest).mockImplementation(
      (path) =>
        Promise.resolve(
          path === '/production/lookups'
            ? { products: [], units: [], locations: [], lots: [] }
            : path === '/production/boms'
              ? []
              : { items: [], total: 0, page: 1, pageSize: 20 },
        ) as never,
    );
    render(<ProductionPanel canEngineer canManage canFinalize />);
    expect(screen.getByRole('heading', { name: 'Produção' })).toBeInTheDocument();
    expect(await screen.findByText('0 fichas técnicas ativas · 0 ordens')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Nova ordem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo' })).toBeInTheDocument();
  });
});
