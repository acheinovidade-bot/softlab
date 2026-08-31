import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { PosPanel } from './PosPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('PosPanel', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    localStorage.clear();
  });
  it('searches a product and adds it to the checkout cart', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      customers: [],
      sellers: [{ id: 'seller-1', name: 'Operador' }],
      paymentMethods: [
        { id: 'cash-1', code: 'DIN', name: 'Dinheiro', type: 'cash' },
        { id: 'pix-1', code: 'PIX', name: 'PIX', type: 'pix' },
      ],
      locations: [{ id: 'location-1', code: 'LOJA', name: 'Loja' }],
      products: [
        {
          id: 'product-1',
          code: 'CAFE-1',
          barcode: '789100000001',
          description: 'Café especial',
          openPrice: false,
          controlsLot: false,
          salePrice: '18.90',
          availableQuantity: '12',
        },
      ],
    } as never);

    render(<PosPanel canDiscount={false} />);
    expect(
      screen.getByRole('heading', { name: 'Liberado para uma nova venda' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'F3' });
    expect(screen.getByRole('dialog', { name: 'Localizar produto' })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /CAFE-1.*Café especial/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cliente F2' }));
    expect(screen.getByRole('dialog', { name: 'Identificar cliente' })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Consumidor não identificado.*Selecionar/ }),
    );
    const search = await screen.findByPlaceholderText('Código, código de barras ou descrição');
    fireEvent.change(search, { target: { value: '5' } });
    fireEvent.keyDown(search, { key: '*' });
    fireEvent.change(search, { target: { value: '789100000001' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByText('Café especial')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Quantidade de Café especial' })).toHaveValue(5);
    expect(screen.getAllByText(/94,50/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Finalizar (F5)' })).toBeEnabled();
    fireEvent.keyDown(window, { key: 'F1' });
    expect(screen.getByRole('dialog', { name: 'Menu de funções' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'F5' });
    expect(screen.getByRole('dialog', { name: 'Forma de recebimento' })).toBeInTheDocument();
    const received = screen.getByLabelText('Valor recebido');
    expect(received).toHaveValue('94.50');
    await waitFor(() => expect(received).toHaveFocus());
    fireEvent.change(received, { target: { value: '100' } });
    fireEvent.keyDown(received, { key: 'Enter' });
    expect(screen.getByRole('button', { name: '1 Dinheiro' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: '1 Dinheiro' }), { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: '2 PIX' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: '2 PIX' }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: '2 PIX' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('R$ 5,50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trabalhar online' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Home' });
    expect(screen.getByRole('dialog', { name: 'Configurações do PDV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Balança checkout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pré-venda desktop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'S@T/MFe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TEF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Impressão' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trabalhar offline' }));
    expect(localStorage.getItem('erp:pos-operation-mode')).toBe('offline');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Trabalhar offline' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });
  it('creates and identifies a customer from the F2 quick form', async () => {
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (path === '/master/customers')
        return Promise.resolve({ id: 'customer-new', legalName: 'João Silva' } as never);
      return Promise.resolve({
        customers: [],
        sellers: [],
        paymentMethods: [],
        locations: [{ id: 'location-1', code: 'LOJA', name: 'Loja' }],
        products: [],
      } as never);
    });
    render(<PosPanel canDiscount={false} />);
    fireEvent.keyDown(window, { key: 'F2' });
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar novo cliente' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'João Silva' } });
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '(85) 99999-0000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e identificar' }));
    expect(await screen.findByText('João Silva')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Identificar cliente' })).not.toBeInTheDocument();
  });
  it('keeps customer and certificate actions inside the PDV', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      customers: [],
      sellers: [],
      paymentMethods: [],
      locations: [{ id: 'location-1', code: 'LOJA', name: 'Loja' }],
      products: [],
    } as never);
    const navigate = vi.fn();
    render(<PosPanel canDiscount={false} onNavigate={navigate} />);

    fireEvent.keyDown(window, { key: 'F1' });
    fireEvent.click(await screen.findByRole('button', { name: /Cadastrar cliente.*CTRL \+ END/ }));
    expect(screen.getByRole('dialog', { name: 'Identificar cliente' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'F1' });
    fireEvent.click(
      await screen.findByRole('button', { name: /Configurar Certificado.*CTRL \+ ALT \+ =/ }),
    );
    expect(screen.getByRole('dialog', { name: 'Certificado digital' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Arquivo do certificado/)).toHaveAttribute(
      'accept',
      '.pfx,.p12,application/x-pkcs12',
    );
    expect(screen.getByLabelText('Senha do certificado')).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('tab', { name: /Token A3/ }));
    expect(screen.getByLabelText('Token ou dispositivo')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha/PIN do token')).toHaveAttribute('type', 'password');
    expect(navigate).not.toHaveBeenCalled();
  });
  it('opens customer credit receipt and statement locally with F11', async () => {
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (path.startsWith('/sales/pos/customers/'))
        return Promise.resolve({
          customer: { id: 'customer-1', name: 'Ana Martins', creditLimit: '1000' },
          period: { from: '2026-08-01', to: '2026-08-31' },
          totalPurchased: '120',
          totalPaid: '40',
          totalDue: '80',
          lastPayment: {
            settledAt: '2026-08-25T14:30:00Z',
            amount: '40',
            account: 'Crediário VEN-010',
            accountStatus: 'partial',
          },
          settlements: [],
          coupons: [],
        } as never);
      return Promise.resolve({
        customers: [{ id: 'customer-1', name: 'Ana Martins' }],
        sellers: [],
        paymentMethods: [{ id: 'pix', code: 'PIX', name: 'PIX', type: 'pix' }],
        locations: [{ id: 'location-1', code: 'LOJA', name: 'Loja' }],
        products: [],
      } as never);
    });

    render(<PosPanel canDiscount={false} canReadCredit canReceiveCredit />);
    fireEvent.keyDown(window, { key: 'F11' });
    const dialog = await screen.findByRole('dialog', { name: 'Recebimento de contas' });
    fireEvent.change(screen.getByPlaceholderText('Digite o nome do cliente'), {
      target: { value: 'Ana' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: /Ana Martins.*Extrato do cliente/ }),
    );
    expect(await screen.findByRole('dialog', { name: 'Extrato do cliente' })).toBeInTheDocument();
    expect(screen.getByText(/Último pagamento/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir extrato 80 mm' })).toBeInTheDocument();
  });
  it('requires a valid lot without interrupting the sale to ask for a seller', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      settings: {
        defaultCustomerId: null,
        defaultSellerId: null,
        defaultLocationId: 'location-1',
        sellerMode: 'per_sale',
      },
      customers: [],
      sellers: [{ id: 'seller-1', name: 'Marina Costa' }],
      paymentMethods: [{ id: 'cash-1', code: 'DIN', name: 'Dinheiro', type: 'cash' }],
      locations: [{ id: 'location-1', code: 'EXP', name: 'Expedição' }],
      products: [
        {
          id: 'product-auto',
          code: 'AUTO-1',
          barcode: '789100000003',
          description: 'Produto com lote automático',
          openPrice: false,
          controlsLot: true,
          controlsExpiry: true,
          selectLotAtPos: false,
          salePrice: '10',
          availableQuantity: '4',
          lots: [],
        },
        {
          id: 'product-1',
          code: 'LOTE-1',
          barcode: '789100000002',
          description: 'Produto rastreado',
          openPrice: false,
          controlsLot: true,
          controlsExpiry: true,
          selectLotAtPos: true,
          salePrice: '20',
          availableQuantity: '5',
          lots: [
            {
              id: 'lot-1',
              lotNumber: 'L-2099',
              expiresAt: '2099-12-31T00:00:00.000Z',
              availableQuantity: '5',
            },
          ],
        },
      ],
    } as never);
    render(<PosPanel canDiscount={false} />);
    const search = await screen.findByPlaceholderText('Código, código de barras ou descrição');
    fireEvent.keyDown(window, { key: 'F3' });
    await screen.findByRole('button', { name: /AUTO-1.*Produto com lote automático/ });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.change(search, { target: { value: 'AUTO-1' } });
    expect(await screen.findByText('Produto com lote automático')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Selecione o lote' })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'LOTE-1' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /Lote L-2099/ }));
    expect(screen.getByText(/Lote L-2099/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Identificar vendedor' })).not.toBeInTheDocument();
    expect(screen.getByText('Consumidor final')).toBeInTheDocument();
  });
});
