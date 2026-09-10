import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { BranchesPanel } from './BranchesPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('BranchesPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiRequest).mockImplementation((path, options) => {
      if (path === '/admin/branches' && options?.method === 'POST')
        return Promise.resolve({
          id: 'branch-2', code: 'LOJA2', legalName: 'Loja Dois Ltda.', tradeName: 'Loja Dois',
          taxId: '01027058000272', status: 'active',
        } as never);
      if (path === '/admin/fiscal-pos-terminals' && options?.method === 'POST')
        return Promise.resolve({ id: 'terminal-2' } as never);
      if (path.includes('/admin/company-profile/cnpj/'))
        return Promise.resolve({ found: true, fields: {
          legalName: 'Loja Receita Ltda.', tradeName: 'Loja Receita', stateRegistration: '123456789',
          cnae: '4711302', email: 'fiscal@loja.test', phone: '8533334444', registrationStatus: 'ATIVA',
          address: { postalCode: '60123000', street: 'Rua Central', number: '20', complement: null,
            district: 'Centro', city: 'Fortaleza', state: 'CE', country: 'BR' },
        } } as never);
      if (path === '/admin/branches')
        return Promise.resolve([{
          id: 'branch-1', code: 'MATRIZ', legalName: 'Matriz Ltda.', tradeName: 'Matriz',
          taxId: '01027058000191', status: 'active',
        }] as never);
      return Promise.resolve([{
        id: 'terminal-1', branchId: 'branch-1', posNumber: 1,
        description: 'Computador principal', cashRegisterCode: 'CAIXA-01', cscToken: '1',
        onlineSeries: '101', offlineSeries: '901', active: true,
      }] as never);
    });
  });

  it('registers fiscal identity per branch and links the selected computer', async () => {
    render(<BranchesPanel canManage />);
    expect(await screen.findByText('PDV 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vincular este computador' }));
    expect(localStorage.getItem('softlab:pos-fiscal-terminal-id')).toBe('terminal-1');

    fireEvent.click(screen.getByRole('button', { name: '+ Novo' }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'loja2' } });
    fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'Loja Dois Ltda.' } });
    fireEvent.change(screen.getByLabelText('Nome fantasia'), { target: { value: 'Loja Dois' } });
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '01027058000272' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar CNPJ na Receita Federal' }));
    await waitFor(() => expect(screen.getByDisplayValue('Loja Receita Ltda.')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Número do PDV'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Descrição do computador/PDV'), { target: { value: 'Caixa dois' } });
    fireEvent.change(screen.getByLabelText('Código do caixa'), { target: { value: 'CAIXA-02' } });
    fireEvent.change(screen.getByLabelText('Token CSC'), { target: { value: '000002' } });
    fireEvent.change(screen.getByLabelText('Chave CSC'), { target: { value: 'segredo-csc' } });
    fireEvent.change(screen.getByLabelText('Série PDV online'), { target: { value: '102' } });
    fireEvent.change(screen.getByLabelText('Série PDV offline'), { target: { value: '902' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar filial' }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/admin/fiscal-pos-terminals',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const call = vi.mocked(apiRequest).mock.calls.find(([path, options]) =>
      path === '/admin/fiscal-pos-terminals' && options?.method === 'POST');
    const requestBody = call?.[1]?.body;
    expect(typeof requestBody).toBe('string');
    expect(JSON.parse(typeof requestBody === 'string' ? requestBody : '{}')).toMatchObject({
      branchId: 'branch-2', posNumber: '2', cashRegisterCode: 'CAIXA-02',
      onlineSeries: '102', offlineSeries: '902',
    });
    const branchCall = vi.mocked(apiRequest).mock.calls.find(([path, options]) => path === '/admin/branches' && options?.method === 'POST');
    const branchBody = branchCall?.[1]?.body;
    expect(JSON.parse(typeof branchBody === 'string' ? branchBody : '{}')).toMatchObject({
      legalName: 'Loja Receita Ltda.', stateRegistration: '123456789', cnae: '4711302',
      email: 'fiscal@loja.test', city: 'Fortaleza', state: 'CE',
    });
  });
});
