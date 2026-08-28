import { useEffect, useState } from 'react';
import type {
  PageResult,
  SalesOrderStatus,
  SalesOrderSummary,
  SalesQuoteStatus,
  SalesQuoteSummary,
} from '@erp/contracts';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

type Lookup = {
  customers: Array<{ id: string; name: string }>;
  sellers: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; name: string }>;
  products: Array<{
    id: string;
    code: string;
    description: string;
    controlsLot: boolean;
    openPrice: boolean;
    price: null | { salePrice: string };
  }>;
  locations: Array<{ id: string; code: string; name: string }>;
  lots: Array<{
    id: string;
    productId: string;
    lotNumber: string;
    expiresAt: string | null;
    balances: Array<{ locationId: string; availableQuantity: string }>;
  }>;
};
type Line = {
  key: number;
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};
const quoteLabels: Record<SalesQuoteStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  converted: 'Convertido',
  expired: 'Vencido',
  canceled: 'Cancelado',
};
const orderLabels: Record<SalesOrderStatus, string> = {
  pending: 'Pedido',
  separation: 'Separação',
  invoicing: 'Faturamento',
  delivery: 'Entrega',
  completed: 'Concluído',
  canceled: 'Cancelado',
};

export function SalesPanel({
  canManage,
  canDiscount,
}: {
  canManage: boolean;
  canDiscount: boolean;
}) {
  const [lookup, setLookup] = useState<Lookup>({
    customers: [],
    sellers: [],
    paymentMethods: [],
    products: [],
    locations: [],
    lots: [],
  });
  const [quotes, setQuotes] = useState<PageResult<SalesQuoteSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [orders, setOrders] = useState<PageResult<SalesOrderSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [order, setOrder] = useState<SalesOrderSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { key: 1, productId: '', quantity: '1', unitPrice: '', discount: '0' },
  ]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function load() {
    try {
      const [nextLookup, nextQuotes, nextOrders] = await Promise.all([
        apiRequest<Lookup>('/sales/lookups'),
        apiRequest<PageResult<SalesQuoteSummary>>('/sales/quotes'),
        apiRequest<PageResult<SalesOrderSummary>>('/sales/orders'),
      ]);
      setLookup(nextLookup);
      setQuotes(nextQuotes);
      setOrders(nextOrders);
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function changeLine(key: number, field: keyof Omit<Line, 'key'>, value: string) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        if (field !== 'productId') return { ...line, [field]: value };
        const product = lookup.products.find(({ id }) => id === value);
        return { ...line, productId: value, unitPrice: product?.price?.salePrice ?? '' };
      }),
    );
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('create');
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest('/sales/quotes', {
        method: 'POST',
        body: JSON.stringify({
          customerId: value(form, 'customerId'),
          sellerId: value(form, 'sellerId'),
          paymentMethodId: value(form, 'paymentMethodId'),
          validUntil: value(form, 'validUntil'),
          discount: value(form, 'discount') ?? '0',
          surcharge: value(form, 'surcharge') ?? '0',
          freight: value(form, 'freight') ?? '0',
          notes: value(form, 'notes'),
          items: lines.map(({ productId, quantity, unitPrice, discount }) => ({
            productId,
            quantity,
            unitPrice: unitPrice || null,
            discount,
          })),
        }),
      });
      setCreating(false);
      setLines([{ key: 1, productId: '', quantity: '1', unitPrice: '', discount: '0' }]);
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy('');
    }
  }
  async function quoteAction(id: string, action: 'sent' | 'approved' | 'canceled' | 'convert') {
    setBusy(id);
    setError('');
    try {
      if (action === 'convert') {
        const created = await apiRequest<SalesOrderSummary>(`/sales/quotes/${id}/convert`, {
          method: 'POST',
        });
        setOrder(created);
      } else
        await apiRequest(`/sales/quotes/${id}/transition`, {
          method: 'POST',
          body: JSON.stringify({ toStatus: action }),
        });
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy('');
    }
  }
  async function open(id: string) {
    try {
      setOrder(await apiRequest<SalesOrderSummary>(`/sales/orders/${id}`));
      setError('');
    } catch (reason) {
      setError(message(reason));
    }
  }
  async function allocate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    setBusy(order.id);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const next = await apiRequest<SalesOrderSummary>(`/sales/orders/${order.id}/allocation`, {
        method: 'PUT',
        body: JSON.stringify({
          items: order.items.map((item) => ({
            orderItemId: item.id,
            locationId: value(form, `location-${item.id}`),
            lotId: value(form, `lot-${item.id}`),
          })),
        }),
      });
      setOrder(next);
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy('');
    }
  }
  async function advanceOrder(toStatus: SalesOrderStatus) {
    if (!order) return;
    setBusy(order.id);
    setError('');
    try {
      const next = await apiRequest<SalesOrderSummary>(`/sales/orders/${order.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus }),
      });
      setOrder(next);
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy('');
    }
  }
  const subtotal = lines.reduce(
    (sum, line) =>
      sum + Number(line.quantity || 0) * Number(line.unitPrice || 0) - Number(line.discount || 0),
    0,
  );
  return (
    <section>
      <PageHeader
        title="Vendas e pedidos"
        description="Orçamentos convertidos sem redigitação, separação rastreável, faturamento e entrega."
        action={canManage ? () => setCreating(true) : undefined}
      />
      {error && <div className="error">{error}</div>}
      {creating && (
        <form className="sales-compose" onSubmit={(event) => void create(event)}>
          <header>
            <div>
              <span className="eyebrow">NOVO ORÇAMENTO</span>
              <h2>Condição comercial</h2>
            </div>
            <strong>{money(subtotal)}</strong>
          </header>
          <div className="inline-form compact">
            <label>
              Cliente
              <select name="customerId">
                <option value="">Consumidor não identificado</option>
                {lookup.customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vendedor
              <select name="sellerId" required>
                <option value="">Selecione</option>
                {lookup.sellers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Forma de pagamento
              <select name="paymentMethodId" required>
                <option value="">Selecione</option>
                {lookup.paymentMethods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Válido até
              <input
                name="validUntil"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                defaultValue={futureDate(7)}
              />
            </label>
          </div>
          <h3>Produtos</h3>
          {lines.map((line) => {
            const product = lookup.products.find(({ id }) => id === line.productId);
            return (
              <div className="sales-line" key={line.key}>
                <select
                  aria-label="Produto"
                  required
                  value={line.productId}
                  onChange={(event) => changeLine(line.key, 'productId', event.target.value)}
                >
                  <option value="">Selecione o produto</option>
                  {lookup.products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.description}
                    </option>
                  ))}
                </select>
                <label>
                  Quantidade
                  <input
                    type="number"
                    min="0.000001"
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) => changeLine(line.key, 'quantity', event.target.value)}
                  />
                </label>
                <label>
                  Preço
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    readOnly={!product?.openPrice}
                    onChange={(event) => changeLine(line.key, 'unitPrice', event.target.value)}
                  />
                </label>
                <label>
                  Desconto
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!canDiscount}
                    value={line.discount}
                    onChange={(event) => changeLine(line.key, 'discount', event.target.value)}
                  />
                </label>
                <strong>
                  {money(
                    Number(line.quantity || 0) * Number(line.unitPrice || 0) -
                      Number(line.discount || 0),
                  )}
                </strong>
                <button
                  type="button"
                  className="link"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) => current.filter(({ key }) => key !== line.key))
                  }
                >
                  Remover
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="quiet"
            onClick={() =>
              setLines((current) => [
                ...current,
                {
                  key: Math.max(...current.map(({ key }) => key)) + 1,
                  productId: '',
                  quantity: '1',
                  unitPrice: '',
                  discount: '0',
                },
              ])
            }
          >
            + Produto
          </button>
          <div className="inline-form compact sales-totals">
            <label>
              Desconto geral
              <input
                name="discount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                disabled={!canDiscount}
              />
            </label>
            <label>
              Acréscimo
              <input name="surcharge" type="number" min="0" step="0.01" defaultValue="0" />
            </label>
            <label>
              Frete
              <input name="freight" type="number" min="0" step="0.01" defaultValue="0" />
            </label>
            <label>
              Observações
              <textarea name="notes" />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="quiet" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button className="primary" disabled={busy === 'create'}>
              Salvar orçamento
            </button>
          </div>
        </form>
      )}
      {order && (
        <section className="sales-order">
          <header>
            <div>
              <span className="eyebrow">{order.number}</span>
              <h2>{order.customer?.name ?? 'Consumidor não identificado'}</h2>
              <p>
                {order.seller.name} · {order.paymentMethod.name} · {money(order.total)}
              </p>
            </div>
            <button className="quiet" onClick={() => setOrder(null)}>
              Fechar
            </button>
          </header>
          <div className="sales-flow">
            {(
              ['pending', 'separation', 'invoicing', 'delivery', 'completed'] as SalesOrderStatus[]
            ).map((status, index, all) => (
              <div className={index <= all.indexOf(order.status) ? 'complete' : ''} key={status}>
                <span>{index + 1}</span>
                <strong>{orderLabels[status]}</strong>
              </div>
            ))}
          </div>
          {order.status === 'separation' && (
            <form onSubmit={(event) => void allocate(event)}>
              <h3>Separação por localização e lote</h3>
              {order.items.map((item) => (
                <div className="allocation-row" key={item.id}>
                  <strong>
                    {item.description}
                    <small>
                      {number(item.quantity)} × {money(item.unitPrice)}
                    </small>
                  </strong>
                  <select
                    name={`location-${item.id}`}
                    required
                    defaultValue={item.locationId ?? ''}
                  >
                    <option value="">Localização</option>
                    {lookup.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} · {location.name}
                      </option>
                    ))}
                  </select>
                  {item.controlsLot ? (
                    <select name={`lot-${item.id}`} required defaultValue={item.lotId ?? ''}>
                      <option value="">Lote</option>
                      {lookup.lots
                        .filter(({ productId }) => productId === item.productId)
                        .map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {lot.lotNumber}
                            {lot.expiresAt ? ` · ${date(lot.expiresAt)}` : ''}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input type="hidden" name={`lot-${item.id}`} value="" />
                  )}
                </div>
              ))}
              <div className="form-actions">
                <button className="quiet" disabled={busy === order.id}>
                  Salvar separação
                </button>
              </div>
            </form>
          )}
          <div className="sales-order-actions">
            {canManage && nextOrder(order.status) && (
              <button
                className="primary"
                disabled={
                  busy === order.id ||
                  (order.status === 'separation' &&
                    order.items.some(({ locationId }) => !locationId))
                }
                onClick={() => void advanceOrder(nextOrder(order.status) ?? 'completed')}
              >
                Avançar para {orderLabels[nextOrder(order.status) ?? 'completed']}
              </button>
            )}
          </div>
        </section>
      )}
      <section className="movement-section">
        <h2>Orçamentos</h2>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Validade</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quotes.items.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <strong>{quote.number}</strong>
                    <small className="cell-subtitle">{quote.itemCount} itens</small>
                  </td>
                  <td>{quote.customer?.name ?? 'Não identificado'}</td>
                  <td>{quote.seller.name}</td>
                  <td>{quote.validUntil ? date(quote.validUntil) : 'Sem prazo'}</td>
                  <td>{money(quote.total)}</td>
                  <td>
                    <span className={`sales-status ${quote.status}`}>
                      {quoteLabels[quote.status]}
                    </span>
                  </td>
                  <td>
                    {canManage && (
                      <div className="row-actions">
                        {quote.status === 'draft' && (
                          <button
                            className="link"
                            onClick={() => void quoteAction(quote.id, 'sent')}
                          >
                            Enviar
                          </button>
                        )}
                        {quote.status === 'sent' && (
                          <button
                            className="link"
                            onClick={() => void quoteAction(quote.id, 'approved')}
                          >
                            Aprovar
                          </button>
                        )}
                        {quote.status === 'approved' && (
                          <button
                            className="link"
                            onClick={() => void quoteAction(quote.id, 'convert')}
                          >
                            Virar pedido
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {quotes.items.length === 0 && <div className="empty-row">Nenhum orçamento.</div>}
        </div>
      </section>
      <section className="movement-section">
        <h2>Pedidos</h2>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Total</th>
                <th>Etapa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.number}</strong>
                  </td>
                  <td>{item.customer?.name ?? 'Não identificado'}</td>
                  <td>{item.seller.name}</td>
                  <td>{money(item.total)}</td>
                  <td>
                    <span className={`sales-status ${item.status}`}>
                      {orderLabels[item.status]}
                    </span>
                  </td>
                  <td>
                    <button className="link" onClick={() => void open(item.id)}>
                      Acompanhar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.items.length === 0 && <div className="empty-row">Nenhum pedido.</div>}
        </div>
      </section>
    </section>
  );
}
function nextOrder(status: SalesOrderStatus): SalesOrderStatus | null {
  return (
    {
      pending: 'separation',
      separation: 'invoicing',
      invoicing: 'delivery',
      delivery: 'completed',
      completed: null,
      canceled: null,
    } as Record<SalesOrderStatus, SalesOrderStatus | null>
  )[status];
}
function value(form: FormData, name: string) {
  const raw = form.get(name);
  const result = typeof raw === 'string' ? raw.trim() : '';
  return result || null;
}
function money(amount: string | number) {
  return Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function number(amount: string | number) {
  return Number(amount).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function date(input: string) {
  return new Date(input).toLocaleDateString('pt-BR');
}
function futureDate(days: number) {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha no fluxo de vendas';
}
