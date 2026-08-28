import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { PublicQuotationPage } from './PublicQuotationPage';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);
const token = 'a'.repeat(43);
const quotation = {
  number: 'COT-1',
  companyName: 'Empresa Compradora',
  supplierName: 'Fornecedor 1',
  responseDeadline: '2099-09-03T23:59:59.000Z',
  expired: false,
  submitted: false,
  items: [
    {
      id: '018f4f12-2222-7222-8222-555555555555',
      product: { code: 'P1', description: 'Produto solicitado' },
      quantity: '5',
      response: null,
    },
  ],
};

describe('PublicQuotationPage', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(
      (path) =>
        Promise.resolve(
          path.endsWith('/responses') ? { ...quotation, submitted: true } : quotation,
        ) as never,
    );
  });
  it('loads and submits a supplier proposal without an ERP login', async () => {
    render(<PublicQuotationPage token={token} />);
    expect(await screen.findByText('Produto solicitado')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Preço unitário (R$)'), { target: { value: '9.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar proposta' }));
    expect(await screen.findByText(/Proposta salva com sucesso/)).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith(
      `/public/quotations/${token}/responses`,
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
