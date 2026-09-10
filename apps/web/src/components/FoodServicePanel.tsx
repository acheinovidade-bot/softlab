import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { PosCheckoutResult } from '@erp/contracts';
import { SaleCompletionDialog, type SaleReceipt } from './SaleCompletionDialog';
import { PrintManagerPanel } from './PrintManagerPanel';
import { printFoodSector } from '../food-printing';
import QRCode from 'qrcode';
type Overview = {
  tables: Array<{
    id: string;
    code: string;
    name: string;
    capacity: number;
    status: string;
    publicToken: string;
  }>;
  waiters: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
  products: Array<{
    id: string;
    code: string;
    description: string;
    unitCode?: string;
    printSector?: string | null;
    price: string;
  }>;
  paymentMethods: Array<{ id: string; name: string; type: string }>;
  locations: Array<{ id: string; code: string; name: string }>;
  tabs: Array<{
    id: string;
    tableId: string | null;
    number: string;
    channel: string;
    waiterId: string | null;
    guests: number;
    openedAt: string;
    itemCount: number;
    total: string;
  }>;
};
type Summary = {
  tab: { number: string; openedAt: string; guests: number };
  items: Array<{
    id: string;
    productId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string;
    notes: string | null;
  }>;
  total: string;
};
export function FoodServicePanel({
  canManage,
  canOperate,
}: {
  canManage: boolean;
  canOperate: boolean;
}) {
  const [data, setData] = useState<Overview>({
    tables: [],
    waiters: [],
    customers: [],
    products: [],
    paymentMethods: [],
    locations: [],
    tabs: [],
  });
  const [tableId, setTableId] = useState<string | null>(null);
  const [channel, setChannel] = useState('table');
  const [tabId, setTabId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [paying, setPaying] = useState(false);
  const [printManagerOpen, setPrintManagerOpen] = useState(false);
  const [tableQr, setTableQr] = useState<{ name: string; url: string; image: string } | null>(null);
  async function load() {
    try {
      setData(await apiRequest<Overview>('/food/overview'));
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => void load(), []);
  const table = data.tables.find(({ id }) => id === tableId);
  const tabs = data.tabs.filter((tab) =>
    channel === 'table' ? tab.tableId === tableId : tab.channel === channel,
  );
  const selected = data.tabs.find(({ id }) => id === tabId) ?? tabs[0];
  async function post(path: string, body: unknown = {}) {
    try {
      const result = await apiRequest<{ id?: string }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (path === '/food/tabs' && result?.id) setTabId(result.id);
      await load();
      return true;
    } catch (reason) {
      setError(message(reason));
      return false;
    }
  }
  async function showSummary(id: string) {
    try {
      setSummary(await apiRequest<Summary>(`/food/tabs/${id}/summary`));
    } catch (reason) {
      setError(message(reason));
    }
  }
  async function checkoutTab(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary || !selected) return;
    const form = new FormData(event.currentTarget);
    const rawPaymentMethodId = form.get('paymentMethodId');
    const paymentMethodId = typeof rawPaymentMethodId === 'string' ? rawPaymentMethodId : '';
    setPaying(true);
    setError('');
    try {
      const result = await apiRequest<PosCheckoutResult>(`/food/tabs/${selected.id}/checkout`, {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey: randomId(),
          sellerId: form.get('sellerId'),
          locationId: form.get('locationId'),
          payments: [{ paymentMethodId, amount: Number(summary.total) }],
        }),
      });
      setReceipt({
        ...result,
        sellerName: data.waiters.find(({ id }) => id === form.get('sellerId'))?.name,
        lines: summary.items.map((item) => ({
          code: data.products.find(({ id }) => id === item.productId)?.code,
          description: item.description,
          unit: data.products.find(({ id }) => id === item.productId)?.unitCode ?? 'UN',
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          total: Number(item.total),
        })),
        payments: [
          {
            name: data.paymentMethods.find(({ id }) => id === paymentMethodId)?.name ?? 'Pagamento',
            amount: Number(summary.total),
          },
        ],
      });
      setSummary(null);
      setTabId(null);
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setPaying(false);
    }
  }
  async function showTableQr(item: Overview['tables'][number]) {
    const url = `${window.location.origin}/menu/${item.publicToken}`;
    try {
      setTableQr({
        name: item.name,
        url,
        image: await QRCode.toDataURL(url, { width: 420, margin: 2, errorCorrectionLevel: 'H' }),
      });
    } catch {
      setError('Não foi possível gerar o QR Code da mesa');
    }
  }
  return (
    <section className="food-screen">
      <header className="food-header">
        <div>
          <span className="eyebrow">FOOD SERVICE</span>
          <h1>Salão e comandas</h1>
          <p>Mesas, múltiplas comandas e atendimento multicanal em uma única operação.</p>
        </div>
        <div className="food-legend">
          <span>
            <i className="free" />
            Livre
          </span>
          <span>
            <i className="occupied" />
            Ocupada
          </span>
          <span>
            <i className="reserved" />
            Reservada
          </span>
        </div>
        <button type="button" className="quiet" onClick={() => setPrintManagerOpen(true)}>
          Configurar impressão
        </button>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="food-channels">
        {(
          [
            ['table', 'Mesas'],
            ['counter', 'Balcão'],
            ['pickup', 'Retirada'],
            ['delivery', 'Delivery'],
            ['kiosk', 'Totem'],
            ['digital_menu', 'Cardápio digital'],
          ] as Array<[string, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={id === channel ? 'active' : ''}
            onClick={() => {
              setChannel(id);
              setTableId(null);
              setTabId(data.tabs.find((tab) => tab.channel === id)?.id ?? null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="food-layout">
        <main>
          {channel === 'table' ? (
            <div className="table-map">
              {data.tables.map((item) => {
                const openTabs = data.tabs.filter(({ tableId }) => tableId === item.id);
                const total = openTabs.reduce((sum, tab) => sum + Number(tab.total), 0);
                return (
                  <button
                    key={item.id}
                    className={`restaurant-table ${item.status} ${tableId === item.id ? 'selected' : ''}`}
                    onClick={() => {
                      setTableId(item.id);
                      setTabId(openTabs[0]?.id ?? null);
                    }}
                  >
                    <span>{item.code}</span>
                    <strong>{item.name}</strong>
                    <small>
                      {openTabs.length
                        ? `${openTabs.length} comanda${openTabs.length > 1 ? 's' : ''}`
                        : `${item.capacity} lugares`}
                    </small>
                    {openTabs.length > 0 && <b>{money(total)}</b>}
                  </button>
                );
              })}
            </div>
          ) : (
            <section className="food-channel-workspace">
              <header>
                <div>
                  <span className="eyebrow">ATENDIMENTO</span>
                  <h2>{channelName(channel)}</h2>
                </div>
                {canOperate && (
                  <button
                    className="primary"
                    onClick={() => void post('/food/tabs', { tableId: null, channel, guests: 1 })}
                  >
                    + Novo atendimento
                  </button>
                )}
              </header>
              <div className="food-channel-orders">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={selected?.id === tab.id ? 'active' : ''}
                    onClick={() => setTabId(tab.id)}
                  >
                    <span>
                      <strong>{tab.number}</strong>
                      <small>
                        {tab.itemCount} itens · {tab.guests} pessoa(s)
                      </small>
                    </span>
                    <b>{money(tab.total)}</b>
                  </button>
                ))}
                {tabs.length === 0 && (
                  <div className="food-empty">
                    <strong>Nenhum atendimento aberto</strong>
                    <span>Use “Novo atendimento” para começar.</span>
                  </div>
                )}
              </div>
            </section>
          )}
          {channel === 'table' && canManage && (
            <details className="food-add-table">
              <summary>+ Adicionar mesa</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const f = new FormData(event.currentTarget);
                  void post('/food/tables', {
                    code: f.get('code'),
                    name: f.get('name'),
                    capacity: f.get('capacity'),
                  });
                }}
              >
                <input name="code" placeholder="Código" required />
                <input name="name" placeholder="Nome" required />
                <input name="capacity" type="number" min="1" defaultValue="4" required />
                <button className="primary">Salvar</button>
              </form>
            </details>
          )}
        </main>
        <aside className="food-drawer">
          {!table && channel === 'table' && (
            <div className="food-empty">
              <strong>Selecione uma mesa</strong>
              <span>Veja comandas e lance consumos.</span>
            </div>
          )}
          {(table || channel !== 'table') && (
            <>
              <header>
                <div>
                  <span className="eyebrow">{table?.code ?? 'CANAL'}</span>
                  <h2>{table?.name ?? channelName(channel)}</h2>
                </div>
                {table && (
                  <>
                    <span className={`cash-badge ${table.status === 'occupied' ? 'open' : ''}`}>
                      {table.status === 'occupied' ? 'Ocupada' : 'Livre'}
                    </span>
                    <button className="quiet" onClick={() => void showTableQr(table)}>
                      QR Code da mesa
                    </button>
                  </>
                )}
              </header>
              <div className="food-tabs">
                <div>
                  {tabs.map((tab, index) => (
                    <button
                      className={selected?.id === tab.id ? 'active' : ''}
                      key={tab.id}
                      onClick={() => setTabId(tab.id)}
                    >
                      Comanda {index + 1}
                      <small>{money(tab.total)}</small>
                    </button>
                  ))}
                  {canOperate && (
                    <button
                      className="new"
                      onClick={() =>
                        void post('/food/tabs', { tableId: table?.id ?? null, channel, guests: 1 })
                      }
                    >
                      + Nova comanda
                    </button>
                  )}
                </div>
                {selected && (
                  <>
                    <section className="food-tab-meta">
                      <span>{selected.number}</span>
                      <span>{selected.guests} pessoas</span>
                      <span>{selected.itemCount} itens</span>
                    </section>
                    {canOperate && (
                      <form
                        className="food-launch"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const f = new FormData(event.currentTarget);
                          const rawProductId = f.get('productId');
                          const productId = typeof rawProductId === 'string' ? rawProductId : '';
                          const quantity = Number(f.get('quantity') ?? 1);
                          const rawNotes = f.get('notes');
                          const notes = typeof rawNotes === 'string' ? rawNotes : '';
                          const product = data.products.find(({ id }) => id === productId);
                          const form = event.currentTarget;
                          void (async () => {
                            const saved = await post(`/food/tabs/${selected.id}/items`, {
                              productId,
                              quantity,
                              notes,
                            });
                            if (!saved) return;
                            if (product)
                              await printFoodSector({
                                sector: product.printSector ?? null,
                                tabNumber: selected.number,
                                code: product.code,
                                description: product.description,
                                quantity,
                                notes,
                              });
                            form.reset();
                          })().catch((reason) => setError(message(reason)));
                        }}
                      >
                        <h3>Lançar produto</h3>
                        <select name="productId" required>
                          <option value="">Selecione o produto</option>
                          {data.products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.code} · {product.description} · {money(product.price)}
                            </option>
                          ))}
                        </select>
                        <div>
                          <input
                            name="quantity"
                            type="number"
                            min="0.001"
                            step="0.001"
                            defaultValue="1"
                            required
                          />
                          <input name="notes" placeholder="Observação: sem cebola…" />
                          <button className="primary">Lançar</button>
                        </div>
                      </form>
                    )}
                    <div className="food-actions">
                      <button
                        className="food-summary"
                        onClick={() => void showSummary(selected.id)}
                      >
                        RESUMO
                      </button>
                      {canOperate && (
                        <button
                          className="quiet"
                          onClick={() => void post(`/food/tabs/${selected.id}/close`)}
                        >
                          Encerrar comanda
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
      {summary && (
        <div className="food-summary-backdrop" role="dialog" aria-modal="true">
          <article className="food-summary-sheet">
            <header>
              <div>
                <span className="eyebrow">RESUMO DE CONSUMO</span>
                <h2>{summary.tab.number}</h2>
              </div>
              <button className="quiet" onClick={() => setSummary(null)}>
                Fechar
              </button>
            </header>
            {summary.items.map((item) => (
              <div className="food-summary-line" key={item.id}>
                <span>
                  {number(item.quantity)} × {item.description}
                  {item.notes && <small>{item.notes}</small>}
                </span>
                <strong>{money(item.total)}</strong>
              </div>
            ))}
            <footer>
              <span>Total</span>
              <strong>{money(summary.total)}</strong>
            </footer>
            {canOperate && (
              <form className="food-payment" onSubmit={(event) => void checkoutTab(event)}>
                <select name="sellerId" required defaultValue={selected?.waiterId ?? ''}>
                  <option value="">Atendente</option>
                  {data.waiters.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select name="locationId" required defaultValue={data.locations[0]?.id ?? ''}>
                  <option value="">Local de saída</option>
                  {data.locations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </select>
                <select
                  name="paymentMethodId"
                  required
                  defaultValue={data.paymentMethods[0]?.id ?? ''}
                >
                  <option value="">Forma de pagamento</option>
                  {data.paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button className="primary" disabled={paying}>
                  {paying ? 'Finalizando…' : `Finalizar pagamento · ${money(summary.total)}`}
                </button>
              </form>
            )}
          </article>
        </div>
      )}
      {receipt && <SaleCompletionDialog receipt={receipt} onNext={() => setReceipt(null)} />}
      {printManagerOpen && (
        <PrintManagerPanel
          sectors={[
            ...new Set([
              'Cozinha',
              'Bar',
              'Expedição',
              ...data.products.flatMap((product) =>
                product.printSector ? [product.printSector] : [],
              ),
            ]),
          ]}
          onClose={() => setPrintManagerOpen(false)}
        />
      )}
      {tableQr && (
        <div
          className="food-summary-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-qr-title"
        >
          <article className="table-qr-sheet">
            <span className="eyebrow">CARDÁPIO DIGITAL</span>
            <h2 id="table-qr-title">QR Code · {tableQr.name}</h2>
            <img src={tableQr.image} alt={`QR Code do cardápio da ${tableQr.name}`} />
            <p>
              Aponte a câmera para abrir o cardápio e enviar o pedido diretamente para a comanda.
            </p>
            <small>{tableQr.url}</small>
            <div>
              <button className="quiet" onClick={() => setTableQr(null)}>
                Fechar
              </button>
              <a className="primary" href={tableQr.image} download={`cardapio-${tableQr.name}.png`}>
                Baixar QR Code
              </a>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function number(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha no Food Service';
}
function randomId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '018f4f12-3333-7333-8333-111111111111';
}
function channelName(channel: string) {
  return (
    (
      {
        table: 'Mesas e comandas',
        counter: 'Venda balcão',
        pickup: 'Retirada',
        delivery: 'Delivery',
        kiosk: 'Totem de autoatendimento',
        digital_menu: 'Cardápio digital',
      } as Record<string, string>
    )[channel] ?? channel
  );
}
