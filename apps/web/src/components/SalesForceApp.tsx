import { useEffect, useMemo, useState } from 'react';
import { apiRequest, refreshSession, setAccessToken } from '../api';
import {
  cacheSalesForce,
  enqueueSalesOperation,
  networkFailure,
  pendingSalesOperations,
  readSalesForceCache,
  synchronizeSalesOperations,
  type OfflineSalesOperation,
} from '../offline-sales-force';

type Lookup = {
  customers: Array<{ id: string; name: string }>;
  sellers: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; name: string }>;
  products: Array<{
    id: string;
    code: string;
    description: string;
    price: { salePrice: string } | null;
  }>;
};
type Line = { productId: string; quantity: number };
type Insights = {
  customer: { id: string; name: string; phone: string | null; whatsapp: string | null };
  summary: { orderCount: number; totalPurchased: string; lastOrderAt: string | null };
  recommendations: Array<{
    productId: string;
    code: string;
    description: string;
    suggestedQuantity: number;
    lastPurchasedAt: string;
    averageIntervalDays: number;
    due: boolean;
  }>;
  history: Array<{
    id: string;
    number: string;
    status: string;
    total: string;
    createdAt: string;
    sale: { id: string; number: string; soldAt: string } | null;
    items: Array<{ id: string; description: string; quantity: string }>;
  }>;
};

export function SalesForceApp({
  canCreateCustomer,
  canInvoice,
  offlineScope,
}: {
  canCreateCustomer: boolean;
  canInvoice: boolean;
  offlineScope: string;
}) {
  const [lookups, setLookups] = useState<Lookup>({
    customers: [],
    sellers: [],
    paymentMethods: [],
    products: [],
  });
  const [view, setView] = useState<'order' | 'customer' | 'history'>('order');
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  async function load() {
    try {
      const value = await apiRequest<Lookup>('/sales/lookups');
      setLookups(value);
      await cacheSalesForce(offlineScope, 'lookups', value);
    } catch (reason) {
      const cached = await readSalesForceCache<Lookup>(offlineScope, 'lookups');
      if (cached) setLookups(cached);
      else setError(text(reason));
    }
  }
  useEffect(() => void load(), []);
  useEffect(() => {
    if (!customerId) return setInsights(null);
    if (customerId.startsWith('local-')) return setInsights(null);
    void apiRequest<Insights>(`/sales/customers/${customerId}/insights`)
      .then((value) => {
        setInsights(value);
        return cacheSalesForce(offlineScope, `insights:${customerId}`, value);
      })
      .catch(async (reason: unknown) => {
        const cached = await readSalesForceCache<Insights>(offlineScope, `insights:${customerId}`);
        if (cached) setInsights(cached);
        else setError(text(reason));
      });
  }, [customerId]);
  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      void sync();
    };
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('erp:sales-force-queue', refresh);
    window.addEventListener('erp:sales-force-sync', refresh);
    void pendingSalesOperations(offlineScope).then(setPending);
    if (navigator.onLine) void sync();
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('erp:sales-force-queue', refresh);
      window.removeEventListener('erp:sales-force-sync', refresh);
    };
  }, [offlineScope]);
  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          Number(lookups.products.find(({ id }) => id === line.productId)?.price?.salePrice ?? 0) *
            line.quantity,
        0,
      ),
    [lines, lookups.products],
  );
  function add(productId: string, quantity = 1) {
    setLines((current) => {
      const found = current.find((line) => line.productId === productId);
      return found
        ? current.map((line) =>
            line.productId === productId ? { ...line, quantity: line.quantity + quantity } : line,
          )
        : [...current, { productId, quantity }];
    });
  }
  async function submitOrder(body: Record<string, unknown>) {
    const quote = await apiRequest<{ id: string }>('/sales/quotes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await apiRequest(`/sales/quotes/${quote.id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ toStatus: 'sent' }),
    });
    await apiRequest(`/sales/quotes/${quote.id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ toStatus: 'approved' }),
    });
    return apiRequest<{ number: string }>(`/sales/quotes/${quote.id}/convert`, {
      method: 'POST',
      body: '{}',
    });
  }
  async function sync() {
    if (!navigator.onLine) return;
    const tokens = await refreshSession();
    if (tokens) setAccessToken(tokens.accessToken);
    const result = await synchronizeSalesOperations(
      offlineScope,
      async (operation: OfflineSalesOperation, resolvedCustomerId) => {
        if (operation.kind === 'customer') {
          const body = { ...operation.body };
          delete body.localId;
          const customer = await apiRequest<{ id: string }>('/master/customers', {
            method: 'POST',
            body: JSON.stringify(body),
          });
          return { serverId: customer.id };
        }
        await submitOrder({ ...operation.body, customerId: resolvedCustomerId });
        return {};
      },
    );
    setPending(result.pending);
    if (result.synced) {
      setMessage(
        `${result.synced} operação${result.synced > 1 ? 'ões' : ''} sincronizada${result.synced > 1 ? 's' : ''}.`,
      );
      await load();
    }
  }
  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const body = {
        customerId,
        sellerId: form.get('sellerId'),
        paymentMethodId: form.get('paymentMethodId'),
        validUntil: null,
        discount: 0,
        surcharge: 0,
        freight: 0,
        notes: 'Pedido criado pelo aplicativo Força de Vendas',
        items: lines.map((line) => ({ ...line, unitPrice: null, discount: 0 })),
      };
      const order = await submitOrder(body);
      setLines([]);
      setMessage(`Pedido ${order.number} enviado para separação.`);
      if (customerId)
        setInsights(await apiRequest<Insights>(`/sales/customers/${customerId}/insights`));
    } catch (reason) {
      if (networkFailure(reason)) {
        await enqueueSalesOperation({
          id: randomId(),
          scope: offlineScope,
          kind: 'order',
          body: {
            customerId,
            sellerId: form.get('sellerId'),
            paymentMethodId: form.get('paymentMethodId'),
            validUntil: null,
            discount: 0,
            surcharge: 0,
            freight: 0,
            notes: 'Pedido criado offline pelo aplicativo Força de Vendas',
            items: lines.map((line) => ({ ...line, unitPrice: null, discount: 0 })),
          },
          createdAt: new Date().toISOString(),
          attempts: 0,
          lastError: null,
        });
        setLines([]);
        setMessage(
          'Pedido salvo no celular. A reserva será confirmada ao sincronizar com o servidor.',
        );
        setPending(await pendingSalesOperations(offlineScope));
      } else setError(text(reason));
    } finally {
      setBusy(false);
    }
  }
  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const body = {
        personType: form.get('personType'),
        taxId: form.get('taxId') || null,
        legalName: form.get('legalName'),
        tradeName: null,
        phone: form.get('phone') || null,
        whatsapp: form.get('phone') || null,
        email: form.get('email') || null,
        creditLimit: 0,
        notes: 'Cadastrado pelo aplicativo Força de Vendas',
        active: true,
        addresses: [],
      };
      const customer = await apiRequest<{ id: string; legalName: string }>('/master/customers', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await load();
      setCustomerId(customer.id);
      setView('order');
      setMessage(`Cliente ${customer.legalName} cadastrado.`);
    } catch (reason) {
      if (networkFailure(reason)) {
        const localId = `local-${randomId()}`;
        const legalName = formText(form, 'legalName') || 'Cliente offline';
        const body = {
          localId,
          personType: form.get('personType'),
          taxId: form.get('taxId') || null,
          legalName,
          tradeName: null,
          phone: form.get('phone') || null,
          whatsapp: form.get('phone') || null,
          email: form.get('email') || null,
          creditLimit: 0,
          notes: 'Cadastrado offline pelo aplicativo Força de Vendas',
          active: true,
          addresses: [],
        };
        await enqueueSalesOperation({
          id: randomId(),
          scope: offlineScope,
          kind: 'customer',
          body,
          createdAt: new Date().toISOString(),
          attempts: 0,
          lastError: null,
        });
        setLookups((current) => ({
          ...current,
          customers: [...current.customers, { id: localId, name: legalName }],
        }));
        setCustomerId(localId);
        setView('order');
        setMessage('Cliente salvo no celular e aguardando sincronização.');
        setPending(await pendingSalesOperations(offlineScope));
      } else setError(text(reason));
    } finally {
      setBusy(false);
    }
  }
  async function issue(saleId: string) {
    setBusy(true);
    setError('');
    try {
      const fiscal = await apiRequest<{ number: number }>(`/fiscal/nfe/${saleId}/issue`, {
        method: 'POST',
        body: JSON.stringify({
          terminalId: localStorage.getItem('softlab:pos-fiscal-terminal-id'),
          offline: false,
        }),
      });
      setMessage(`NF-e ${fiscal.number} emitida com sucesso.`);
    } catch (reason) {
      setError(text(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sales-force-app">
      <header>
        <div>
          <span className="eyebrow">APP MÓVEL</span>
          <h1>Força de Vendas</h1>
          <p>Clientes, pedidos e inteligência comercial na palma da mão.</p>
        </div>
        <span className={`sales-force-online ${online ? '' : 'offline'}`}>
          ● {online ? 'Online' : 'Offline'}
          {pending ? ` · ${pending} pendente${pending > 1 ? 's' : ''}` : ''}
        </span>
      </header>
      <nav>
        <button className={view === 'order' ? 'active' : ''} onClick={() => setView('order')}>
          Novo pedido
        </button>
        <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
          Clientes
        </button>
        {canCreateCustomer && (
          <button
            className={view === 'customer' ? 'active' : ''}
            onClick={() => setView('customer')}
          >
            Cadastrar
          </button>
        )}
      </nav>
      {error && <div className="error">{error}</div>}
      {message && <div className="success-message">{message}</div>}
      {view !== 'customer' && (
        <label className="sales-force-customer">
          Cliente
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Selecione o cliente</option>
            {lookups.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {view === 'order' && (
        <form className="sales-force-order" onSubmit={(event) => void createOrder(event)}>
          <div className="sales-force-products">
            <h2>Produtos</h2>
            {lookups.products
              .filter((product) => product.price)
              .map((product) => (
                <button type="button" key={product.id} onClick={() => add(product.id)}>
                  <span>
                    <b>{product.description}</b>
                    <small>{product.code}</small>
                  </span>
                  <strong>{money(product.price!.salePrice)}</strong>
                  <i>+</i>
                </button>
              ))}
          </div>
          <aside>
            <h2>Pedido</h2>
            {insights?.recommendations.some(({ due }) => due) && (
              <div className="sales-force-tip">
                <b>Sugestões para este cliente</b>
                {insights.recommendations
                  .filter(({ due }) => due)
                  .slice(0, 3)
                  .map((item) => (
                    <button
                      type="button"
                      key={item.productId}
                      onClick={() => add(item.productId, item.suggestedQuantity)}
                    >
                      + {item.description} · {item.suggestedQuantity}
                    </button>
                  ))}
              </div>
            )}
            {lines.map((line) => {
              const product = lookups.products.find(({ id }) => id === line.productId);
              return (
                <div className="sales-force-line" key={line.productId}>
                  <span>
                    {product?.description}
                    <small>
                      {line.quantity} × {money(product?.price?.salePrice ?? 0)}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((item) => item.productId !== line.productId),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <select name="sellerId" required>
              <option value="">Vendedor</option>
              {lookups.sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
            <select name="paymentMethodId" required>
              <option value="">Pagamento</option>
              {lookups.paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
            <footer>
              <span>Total</span>
              <b>{money(total)}</b>
            </footer>
            <button className="primary" disabled={busy || !customerId || !lines.length}>
              {busy ? 'Enviando…' : 'Fechar pedido'}
            </button>
          </aside>
        </form>
      )}
      {view === 'customer' && (
        <form className="sales-force-register" onSubmit={(event) => void createCustomer(event)}>
          <h2>Cadastro rápido</h2>
          <select name="personType">
            <option value="F">Pessoa física</option>
            <option value="J">Pessoa jurídica</option>
          </select>
          <input name="legalName" placeholder="Nome ou razão social" required />
          <input name="taxId" inputMode="numeric" placeholder="CPF/CNPJ (opcional)" />
          <input name="phone" inputMode="tel" placeholder="Telefone / WhatsApp" />
          <input name="email" type="email" placeholder="E-mail" />
          <button className="primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Cadastrar cliente'}
          </button>
        </form>
      )}
      {view === 'history' && insights && (
        <div className="sales-force-history">
          <section className="sales-force-summary">
            <span>
              <b>{insights.summary.orderCount}</b> pedidos
            </span>
            <span>
              <b>{money(insights.summary.totalPurchased)}</b> comprado
            </span>
            <span>
              <b>{insights.recommendations.filter(({ due }) => due).length}</b> sugestões
            </span>
          </section>
          <h2>Histórico de {insights.customer.name}</h2>
          {insights.history.map((order) => (
            <article key={order.id}>
              <header>
                <span>
                  <b>{order.number}</b>
                  <small>
                    {new Date(order.createdAt).toLocaleDateString('pt-BR')} · {order.status}
                  </small>
                </span>
                <strong>{money(order.total)}</strong>
              </header>
              {order.items.map((item) => (
                <p key={item.id}>
                  {Number(item.quantity).toLocaleString('pt-BR')} × {item.description}
                </p>
              ))}
              {canInvoice && order.sale && (
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() => void issue(order.sale!.id)}
                >
                  Gerar NF-e · {order.sale.number}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function text(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha no aplicativo de vendas';
}
function randomId() {
  return crypto.randomUUID();
}
function formText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
