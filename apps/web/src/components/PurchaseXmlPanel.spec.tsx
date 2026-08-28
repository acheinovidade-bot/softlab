import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { PurchaseXmlPanel } from './PurchaseXmlPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn((path: string) => Promise.resolve(path === '/purchases/xml-imports/products' ? [{ id: 'product', code: 'P1', description: 'Produto interno' }] : { items: [], total: 0, page: 1, pageSize: 20 })) }));

describe('PurchaseXmlPanel', () => {
  it('shows the secure XML workflow to users allowed to import', async () => {
    render(<PurchaseXmlPanel canImport />);
    expect(screen.getByText('Importar XML de compra')).toBeInTheDocument();
    expect(screen.getByText('Escolher XML')).toBeInTheDocument();
    expect(screen.getByText(/DTD e entidades externas são rejeitadas/)).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma importação realizada.')).toBeInTheDocument();
  });

  it('keeps history read-only without import permission', async () => {
    render(<PurchaseXmlPanel canImport={false} />);
    expect(screen.queryByText('Escolher XML')).not.toBeInTheDocument();
    expect(await screen.findByText('Nenhuma importação realizada.')).toBeInTheDocument();
  });
});
