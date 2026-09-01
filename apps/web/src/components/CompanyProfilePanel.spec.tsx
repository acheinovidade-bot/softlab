import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { CompanyProfilePanel } from './CompanyProfilePanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('CompanyProfilePanel', () => {
  it('consults CNPJ with Enter and fills the company registration', async () => {
    vi.mocked(apiRequest).mockImplementation((path: string) => {
      if (path === '/admin/fiscal-pos-terminals') return Promise.resolve([] as never);
      if (path.includes('/cnpj/')) return Promise.resolve({ found: true, fields: {
        legalName: 'Empresa Receita Ltda', tradeName: 'Empresa Receita', phone: '8533334444',
        email: 'fiscal@empresa.test', cnae: '4711302', stateRegistration: '123456789',
        registrationStatus: 'ATIVA', address: { postalCode: '60123000', street: 'Rua Central',
          number: '100', complement: null, district: 'Centro', city: 'Fortaleza', state: 'CE', country: 'BR' },
      } } as never);
      return Promise.resolve({ id: 'company', taxId: '11222333000181', legalName: 'Empresa antiga',
        tradeName: null, timezone: 'America/Fortaleza', stateRegistration: null,
        municipalRegistration: null, taxRegime: null, cnae: null, phone: null, email: null,
        postalCode: null, street: null, addressNumber: null, complement: null, district: null,
        city: null, state: null } as never);
    });
    render(<CompanyProfilePanel canManage />);
    const cnpj = await screen.findByLabelText(/CNPJ/);
    fireEvent.keyDown(cnpj, { key: 'Enter' });
    await waitFor(() => expect(screen.getByDisplayValue('Empresa Receita Ltda')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Fortaleza')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/admin/company-profile/cnpj/11222333000181');
  });
});
