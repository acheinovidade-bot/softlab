import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { CustomersPanel, SuppliersPanel } from './MasterDataPanels';

vi.mock('../api', () => ({ apiRequest: vi.fn((path: string) => Promise.resolve(path.includes('/enrichment/cnpj/') ? { cnpj: '11222333000181', found: true, provider: 'brasilapi', fields: { legalName: 'Empresa sugerida', tradeName: 'Sugestão', phone: null, email: null, registrationStatus: 'ATIVA', address: { postalCode: '60123000', street: 'Rua Central', number: '10', district: 'Centro', city: 'Fortaleza', state: 'CE', country: 'BR' } }, sourceUrl: 'https://brasilapi.com.br/api/cnpj/v1/11222333000181', warnings: ['Confirme os dados.'] } : path === '/master/supplier-products/catalog' ? [{ id: 'product', code: 'P1', description: 'Produto vinculado' }] : path.includes('/master/supplier-products/supplier/') ? [] : path.startsWith('/master/suppliers') ? { items: [{ id: 'supplier', taxId: '11222333000181', legalName: 'Fornecedor Exemplo', tradeName: null, email: null, phone: null, averageLeadDays: 5, paymentTerms: null, active: true }], total: 1, page: 1, pageSize: 20 } : { items: [{ id: 'customer', personType: 'F', taxId: '52998224725', legalName: 'Ana Cliente', tradeName: null, phone: null, whatsapp: '85999999999', email: null, creditLimit: '500.0000', active: true }], total: 1, page: 1, pageSize: 20 })) }));

describe('CustomersPanel', () => {
  it('renders tenant customer data and hides management actions without permission', async () => {
    render(<CustomersPanel canManage={false} />);
    expect(await screen.findByText('Ana Cliente')).toBeInTheDocument();
    expect(screen.queryByText('Inativar')).not.toBeInTheDocument();
  });

  it('only applies CNPJ data after explicit confirmation', async () => {
    render(<CustomersPanel canManage />);
    await screen.findByText('Ana Cliente'); fireEvent.click(screen.getByText('+ Novo'));
    const taxId = document.querySelector<HTMLInputElement>('input[name="taxId"]')!; const legalName = document.querySelector<HTMLInputElement>('input[name="legalName"]')!;
    fireEvent.change(taxId, { target: { value: '11222333000181' } }); fireEvent.click(screen.getByText('Consultar CNPJ'));
    expect(await screen.findByText('Empresa sugerida')).toBeInTheDocument(); expect(legalName).toHaveValue('');
    fireEvent.click(screen.getByText('Aplicar sugestões')); expect(legalName).toHaveValue('Empresa sugerida');
  });
});

describe('SuppliersPanel', () => {
  it('opens the tenant product catalog for a supplier', async () => {
    render(<SuppliersPanel canManage />); expect(await screen.findByText('Fornecedor Exemplo')).toBeInTheDocument(); fireEvent.click(screen.getByText('Produtos'));
    expect(await screen.findByText('Produtos fornecidos por Fornecedor Exemplo')).toBeInTheDocument(); expect(screen.getByRole('checkbox', { name: 'P1 · Produto vinculado' })).toBeInTheDocument();
  });
});
