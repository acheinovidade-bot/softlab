import { useEffect, useMemo, useRef, useState } from 'react';
import type { PosCheckoutResult, PosProduct } from '@erp/contracts';
import { apiRequest } from '../api';
import { CustomerStatementPanel } from './CustomerStatementPanel';
import { SaleCompletionDialog, type SaleReceipt } from './SaleCompletionDialog';
import {
  cachePosLookups,
  enqueueCheckout,
  isNetworkFailure,
  pendingCheckoutCount,
  readPosLookups,
  synchronizeCheckouts,
} from '../offline-pos';

type Lookup = {
  customers: Array<{ id: string; name: string }>;
  sellers: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; code: string; name: string; type: string }>;
  locations: Array<{ id: string; code: string; name: string }>;
  products: PosProduct[];
  settings?: {
    defaultCustomerId: string | null;
    defaultSellerId: string | null;
    defaultLocationId: string | null;
  };
};
type CartItem = PosProduct & { quantity: number; unitPrice: number; discount: number };
type PaymentDraft = { key: number; paymentMethodId: string; amount: string };

export function PosPanel({
  canDiscount,
  canReadCredit = false,
  canReceiveCredit = false,
  offlineScope = 'default',
  onOpenSettings,
}: {
  canDiscount: boolean;
  canReadCredit?: boolean;
  canReceiveCredit?: boolean;
  offlineScope?: string;
  onOpenSettings?: () => void;
}) {
  const [lookup, setLookup] = useState<Lookup>({
    customers: [],
    sellers: [],
    paymentMethods: [],
    locations: [],
    products: [],
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [payments, setPayments] = useState<PaymentDraft[]>([
    { key: 1, paymentMethodId: '', amount: '0.00' },
  ]);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [statementOpen, setStatementOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingOffline, setPendingOffline] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const paymentRef = useRef<HTMLInputElement>(null);
  const requestKey = useRef(randomId());
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0),
    [cart],
  );
  const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const results = search.trim()
    ? lookup.products
        .filter((item) =>
          [item.code, item.barcode, item.description].some((field) =>
            field?.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        )
        .slice(0, 8)
    : [];
  const usesCredit = payments.some(
    (payment) =>
      lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId)?.type ===
      'credit_account',
  );

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiRequest<Lookup>('/sales/pos/lookups');
        await cachePosLookups(offlineScope, data);
        setLookup(data);
        applyDefaults(data);
        setPayments([
          { key: 1, paymentMethodId: data.paymentMethods[0]?.id ?? '', amount: '0.00' },
        ]);
      } catch (reason) {
        const cached = await readPosLookups<Lookup>(offlineScope);
        if (!cached) return setError(message(reason));
        setLookup(cached);
        applyDefaults(cached);
        setPayments([
          { key: 1, paymentMethodId: cached.paymentMethods[0]?.id ?? '', amount: '0.00' },
        ]);
        setError('Modo offline: usando catálogo armazenado neste dispositivo');
      }
    })();
  }, [offlineScope]);

  function applyDefaults(data: Lookup) {
    const customer = data.settings?.defaultCustomerId;
    const seller = data.settings?.defaultSellerId;
    const location = data.settings?.defaultLocationId;
    setCustomerId(data.customers.some(({ id }) => id === customer) ? customer! : '');
    setSellerId(data.sellers.some(({ id }) => id === seller) ? seller! : (data.sellers[0]?.id ?? ''));
    setLocationId(
      data.locations.some(({ id }) => id === location) ? location! : (data.locations[0]?.id ?? ''),
    );
  }
  useEffect(() => {
    async function updateCount() {
      setPendingOffline(await pendingCheckoutCount(offlineScope));
    }
    async function synchronize() {
      if (!navigator.onLine) return;
      setOnline(true);
      setSyncing(true);
      try {
        await synchronizeCheckouts(offlineScope, (body) =>
          apiRequest('/sales/pos/checkout', { method: 'POST', body: JSON.stringify(body) }),
        );
        await updateCount();
      } finally {
        setSyncing(false);
      }
    }
    function disconnected() {
      setOnline(false);
    }
    function connected() {
      void synchronize();
    }
    void updateCount();
    void synchronize();
    window.addEventListener('offline', disconnected);
    window.addEventListener('online', connected);
    window.addEventListener('erp:offline-queue', connected);
    window.addEventListener('erp:network-restored', connected);
    return () => {
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('online', connected);
      window.removeEventListener('erp:offline-queue', connected);
      window.removeEventListener('erp:network-restored', connected);
    };
  }, [offlineScope]);
  useEffect(() => {
    if (payments.length === 1)
      setPayments((current) => current.map((item) => ({ ...item, amount: total.toFixed(2) })));
  }, [total]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'F4') {
        event.preventDefault();
        paymentRef.current?.focus();
      }
      if (event.key === 'F9') {
        if (receipt) return;
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
      if (
        event.key === 'Escape' &&
        cart.length &&
        window.confirm('Cancelar a venda atual e remover todos os itens?')
      )
        reset();
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [cart.length, receipt]);

  function add(product: PosProduct) {
    if (product.salePrice === null && !product.openPrice)
      return setError('Produto sem preço vigente');
    setCart((current) => {
      const existing = current.find(({ id }) => id === product.id);
      return existing
        ? current.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [
            ...current,
            { ...product, quantity: 1, unitPrice: Number(product.salePrice ?? 0), discount: 0 },
          ];
    });
    setSearch('');
    setError('');
    searchRef.current?.focus();
  }
  function addFromSearch() {
    const normalized = search.trim().toLowerCase();
    const exact = lookup.products.find(
      (item) => item.code.toLowerCase() === normalized || item.barcode === search.trim(),
    );
    const product = exact ?? results[0];
    if (product) add(product);
  }
  function update(id: string, field: 'quantity' | 'unitPrice' | 'discount', value: number) {
    setCart((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: Math.max(0, value) } : item)),
    );
  }
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) return setError('Adicione ao menos um produto');
    if (!sellerId || !locationId)
      return setError('Defina o vendedor e o local padrão nas Configurações do PDV');
    if (Math.abs(paid - total) > 0.009)
      return setError('Os pagamentos devem fechar exatamente o total da venda');
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const body = {
        idempotencyKey: requestKey.current,
        customerId: customerId || null,
        sellerId,
        locationId,
        notes: field(form, 'notes'),
        creditDueDate: field(form, 'creditDueDate'),
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.openPrice ? item.unitPrice : null,
          discount: item.discount,
        })),
        payments: payments.map(({ paymentMethodId, amount }) => ({ paymentMethodId, amount })),
      };
      const result = await apiRequest<PosCheckoutResult>('/sales/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setReceipt({
        ...result,
        customerName: lookup.customers.find(({ id }) => id === body.customerId)?.name,
        lines: cart.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice - item.discount,
        })),
        payments: payments.map((payment) => ({
          name:
            lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId)?.name ??
            'Pagamento',
          amount: Number(payment.amount),
        })),
      });
      reset(false);
    } catch (reason) {
      if (!navigator.onLine || isNetworkFailure(reason)) {
        const key = requestKey.current;
        const body = {
          idempotencyKey: key,
          customerId: customerId || null,
          sellerId,
          locationId,
          notes: field(form, 'notes'),
          creditDueDate: field(form, 'creditDueDate'),
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            unitPrice: item.openPrice ? item.unitPrice : null,
            discount: item.discount,
          })),
          payments: payments.map(({ paymentMethodId, amount }) => ({ paymentMethodId, amount })),
        };
        await enqueueCheckout({
          id: key,
          scope: offlineScope,
          body,
          total,
          itemCount: cart.length,
          createdAt: new Date().toISOString(),
          attempts: 0,
          lastError: null,
        });
        setPendingOffline(await pendingCheckoutCount(offlineScope));
        setReceipt({
          orderId: `offline:${key}`,
          orderNumber: 'PENDENTE',
          saleId: `offline:${key}`,
          saleNumber: `OFF-${key.slice(0, 8).toUpperCase()}`,
          total: total.toFixed(2),
          itemCount: cart.length,
          paymentCount: payments.length,
          soldAt: new Date().toISOString(),
          offlinePending: true,
          customerName: lookup.customers.find(({ id }) => id === body.customerId)?.name,
          lines: cart.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice - item.discount,
          })),
          payments: payments.map((payment) => ({
            name:
              lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId)?.name ??
              'Pagamento',
            amount: Number(payment.amount),
          })),
        });
        reset(false);
      } else setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  function reset(clearReceipt = true) {
    setCart([]);
    setSearch('');
    setCustomerId(lookup.settings?.defaultCustomerId ?? '');
    setPayments([{ key: 1, paymentMethodId: lookup.paymentMethods[0]?.id ?? '', amount: '0.00' }]);
    requestKey.current = randomId();
    if (clearReceipt) setReceipt(null);
  }
  return (
    <section className="pos-screen">
      <header className="pos-header">
        <div>
          <span className="eyebrow">PONTO DE VENDA</span>
          <h1>Venda rápida</h1>
        </div>
        <div className="pos-header-tools">
          {onOpenSettings && (
            <button type="button" className="quiet" onClick={onOpenSettings}>
              Configurações do PDV
            </button>
          )}
          <div className={`pos-connectivity ${online ? 'online' : 'offline'}`}>
            <span>{online ? '● Online' : '● Offline'}</span>
            {pendingOffline > 0 && (
              <strong>
                {syncing ? 'Sincronizando…' : `${pendingOffline} venda(s) pendente(s)`}
              </strong>
            )}
          </div>
          <div className="pos-shortcuts">
            <span>
              <kbd>F2</kbd> Produto
            </span>
            <span>
              <kbd>F4</kbd> Pagamento
            </span>
            <span>
              <kbd>F9</kbd> Finalizar
            </span>
            <span>
              <kbd>Esc</kbd> Cancelar
            </span>
          </div>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {receipt && (
        <SaleCompletionDialog
          receipt={receipt}
          onNext={() => {
            setReceipt(null);
            searchRef.current?.focus();
          }}
        />
      )}
      <form ref={formRef} className="pos-layout" onSubmit={(event) => void checkout(event)}>
        <main className="pos-catalog">
          <div className="pos-search">
            <input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addFromSearch();
                }
              }}
              placeholder="Código, código de barras ou descrição"
            />
            <button type="button" className="primary" onClick={addFromSearch}>
              Adicionar
            </button>
          </div>
          {results.length > 0 && (
            <div className="pos-results">
              {results.map((product) => (
                <button type="button" key={product.id} onClick={() => add(product)}>
                  <span>
                    <strong>{product.code}</strong>
                    {product.description}
                  </span>
                  <span>
                    {product.salePrice === null ? 'Preço aberto' : money(product.salePrice)}
                    <small>Disponível {number(product.availableQuantity)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="pos-cart">
            <div className="pos-cart-head">
              <span>Produto</span>
              <span>Qtd.</span>
              <span>Preço</span>
              <span>Desconto</span>
              <span>Total</span>
              <span />
            </div>
            {cart.map((item) => (
              <div className="pos-cart-row" key={item.id}>
                <span>
                  <strong>{item.code}</strong>
                  {item.description}
                  <small>
                    {item.controlsLot
                      ? 'Saída FEFO por lote'
                      : `Disponível ${number(item.availableQuantity)}`}
                  </small>
                </span>
                <input
                  aria-label={`Quantidade de ${item.description}`}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={item.quantity}
                  onChange={(event) => update(item.id, 'quantity', Number(event.target.value))}
                />
                <input
                  aria-label={`Preço de ${item.description}`}
                  type="number"
                  min="0"
                  step="0.01"
                  readOnly={!item.openPrice}
                  value={item.unitPrice}
                  onChange={(event) => update(item.id, 'unitPrice', Number(event.target.value))}
                />
                <input
                  aria-label={`Desconto de ${item.description}`}
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canDiscount}
                  value={item.discount}
                  onChange={(event) => update(item.id, 'discount', Number(event.target.value))}
                />
                <strong>{money(item.quantity * item.unitPrice - item.discount)}</strong>
                <button
                  type="button"
                  className="pos-remove"
                  aria-label={`Remover ${item.description}`}
                  onClick={() => setCart((current) => current.filter(({ id }) => id !== item.id))}
                >
                  ×
                </button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="pos-empty">
                Leia um código de barras ou pesquise um produto para começar.
              </div>
            )}
          </div>
        </main>
        <aside className="pos-checkout">
          <div className="pos-defaults" aria-label="Padrões desta venda">
            <span>
              Vendedor <strong>{lookup.sellers.find(({ id }) => id === sellerId)?.name ?? 'Não configurado'}</strong>
            </span>
            <span>
              Estoque <strong>{lookup.locations.find(({ id }) => id === locationId)?.name ?? 'Não configurado'}</strong>
            </span>
            <span>
              Cliente <strong>{lookup.customers.find(({ id }) => id === customerId)?.name ?? 'Consumidor não identificado'}</strong>
            </span>
          </div>
          {canReadCredit && (
            <button
              type="button"
              className="quiet"
              disabled={!customerId}
              onClick={() => setStatementOpen(true)}
            >
              Extrato do cliente
            </button>
          )}
          <div className="pos-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
            <small>{cart.length} produtos no carrinho</small>
          </div>
          <h2>Pagamentos</h2>
          {payments.map((payment, index) => (
            <div className="pos-payment" key={payment.key}>
              <select
                aria-label="Forma de pagamento"
                required
                value={payment.paymentMethodId}
                onChange={(event) =>
                  setPayments((current) =>
                    current.map((item) =>
                      item.key === payment.key
                        ? { ...item, paymentMethodId: event.target.value }
                        : item,
                    ),
                  )
                }
              >
                <option value="">Forma</option>
                {lookup.paymentMethods
                  .filter(
                    (method) =>
                      method.id === payment.paymentMethodId ||
                      !payments.some(({ paymentMethodId }) => paymentMethodId === method.id),
                  )
                  .map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
              </select>
              <input
                ref={index === 0 ? paymentRef : undefined}
                aria-label="Valor do pagamento"
                required
                type="number"
                min="0.01"
                step="0.01"
                value={payment.amount}
                onChange={(event) =>
                  setPayments((current) =>
                    current.map((item) =>
                      item.key === payment.key ? { ...item, amount: event.target.value } : item,
                    ),
                  )
                }
              />
              {payments.length > 1 && (
                <button
                  type="button"
                  className="pos-remove"
                  onClick={() =>
                    setPayments((current) => current.filter(({ key }) => key !== payment.key))
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="quiet"
            disabled={payments.length >= lookup.paymentMethods.length}
            onClick={() =>
              setPayments((current) => [
                ...current,
                {
                  key: Math.max(...current.map(({ key }) => key)) + 1,
                  paymentMethodId:
                    lookup.paymentMethods.find(
                      ({ id }) => !current.some(({ paymentMethodId }) => paymentMethodId === id),
                    )?.id ?? '',
                  amount: Math.max(0, total - paid).toFixed(2),
                },
              ])
            }
          >
            + Forma de pagamento
          </button>
          <div className={`pos-balance ${Math.abs(total - paid) < 0.009 ? 'ok' : ''}`}>
            <span>Falta</span>
            <strong>{money(Math.max(0, total - paid))}</strong>
          </div>
          {usesCredit && (
            <label>
              Vencimento do crediário
              <input name="creditDueDate" type="date" required />
            </label>
          )}
          <label>
            Observações
            <textarea name="notes" rows={2} />
          </label>
          <button
            className="pos-finish"
            disabled={busy || !cart.length || Math.abs(total - paid) > 0.009}
          >
            {busy ? 'Finalizando…' : 'F9 · Finalizar venda'}
          </button>
        </aside>
      </form>
      {statementOpen && customerId && (
        <CustomerStatementPanel
          customerId={customerId}
          paymentMethods={lookup.paymentMethods}
          canReceive={canReceiveCredit}
          onClose={() => setStatementOpen(false)}
        />
      )}
    </section>
  );
}
function field(form: FormData, name: string) {
  const raw = form.get(name);
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || null;
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function number(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function randomId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '018f4f12-2222-7222-8222-111111111111';
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha no PDV';
}
