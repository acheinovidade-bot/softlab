import { useEffect, useState } from 'react';
import type {
  FefoPreview,
  PageResult,
  StockLookups,
  StockLotOverview,
  StockMovementSummary,
  StockOverview,
} from '@erp/contracts';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

const emptyOverview: StockOverview = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  summary: { out: 0, low: 0, ok: 0 },
};
const emptyLookups: StockLookups = { warehouses: [], locations: [], products: [], lots: [] };
const emptyLots: StockLotOverview = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  summary: { expired: 0, within15: 0, within30: 0, within60: 0, within90: 0 },
};
const movementLabels: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  adjustment_in: 'Ajuste positivo',
  adjustment_out: 'Ajuste negativo',
  loss: 'Perda',
  return_in: 'Devolução recebida',
};

export function StockPanel({
  canAdjust,
  canReadMovements,
}: {
  canAdjust: boolean;
  canReadMovements: boolean;
}) {
  const [overview, setOverview] = useState(emptyOverview);
  const [lookups, setLookups] = useState(emptyLookups);
  const [lotsOverview, setLotsOverview] = useState(emptyLots);
  const [movements, setMovements] = useState<PageResult<StockMovementSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [adjusting, setAdjusting] = useState(false);
  const [creatingLot, setCreatingLot] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [fefo, setFefo] = useState<FefoPreview | null>(null);
  const [error, setError] = useState('');
  async function load(search = '') {
    try {
      const movementRequest: Promise<PageResult<StockMovementSummary>> = canReadMovements
        ? apiRequest('/stock/movements')
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 });
      const [nextOverview, nextLookups, nextMovements, nextLots] = await Promise.all([
        apiRequest<StockOverview>(`/stock/overview?search=${encodeURIComponent(search)}`),
        apiRequest<StockLookups>('/stock/lookups'),
        movementRequest,
        apiRequest<StockLotOverview>(`/stock/lots?search=${encodeURIComponent(search)}`),
      ]);
      setOverview(nextOverview);
      setLookups(nextLookups);
      setMovements(nextMovements);
      setLotsOverview(nextLots);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar estoque');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function adjust(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest('/stock/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          productId: data.get('productId'),
          locationId: data.get('locationId'),
          lotId: text(data, 'lotId'),
          movementType: data.get('movementType'),
          quantity: data.get('quantity'),
          unitCost: text(data, 'unitCost'),
          reason: data.get('reason'),
        }),
      });
      setAdjusting(false);
      setSelectedProduct('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha na movimentação');
    }
  }
  async function createLot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest('/stock/lots', {
        method: 'POST',
        body: JSON.stringify({
          productId: data.get('productId'),
          lotNumber: data.get('lotNumber'),
          manufacturedAt: text(data, 'manufacturedAt'),
          expiresAt: text(data, 'expiresAt'),
        }),
      });
      setCreatingLot(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao criar lote');
    }
  }
  async function previewFefo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const productId = text(data, 'productId');
    const quantity = text(data, 'quantity');
    if (!productId || !quantity) return;
    try {
      setFefo(
        await apiRequest<FefoPreview>(
          `/stock/fefo/${productId}?quantity=${encodeURIComponent(quantity)}`,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao calcular FEFO');
    }
  }
  const product = lookups.products.find(({ id }) => id === selectedProduct);
  const lots = lookups.lots.filter(({ productId }) => productId === selectedProduct);
  return (
    <section>
      <PageHeader
        title="Estoque atual"
        description="Saldo por filial, alertas, FEFO e histórico imutável."
        action={canAdjust ? () => setAdjusting(true) : undefined}
      />
      <div className="metric-grid">
        <Metric label="Produtos regulares" value={overview.summary.ok} tone="ok" />
        <Metric label="Estoque mínimo" value={overview.summary.low} tone="warn" />
        <Metric label="Sem estoque" value={overview.summary.out} tone="danger" />
        <Metric label="Produtos exibidos" value={overview.items.length} />
      </div>
      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void load(text(new FormData(event.currentTarget), 'search') ?? '');
        }}
      >
        <input name="search" placeholder="Produto, código, código de barras ou lote" />
        <button className="quiet">Pesquisar</button>
      </form>
      {error && <div className="error">{error}</div>}
      {canAdjust && (
        <div className="stock-actions">
          <button className="quiet" onClick={() => setCreatingLot(true)}>
            + Novo lote
          </button>
        </div>
      )}
      {adjusting && (
        <form className="inline-form" onSubmit={(event) => void adjust(event)}>
          <label>
            Produto
            <select
              name="productId"
              required
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
            >
              <option value="">Selecione</option>
              {lookups.products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.description}
                </option>
              ))}
            </select>
          </label>
          <label>
            Localização
            <select name="locationId" required>
              <option value="">Selecione</option>
              {lookups.locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Movimento
            <select name="movementType">
              <option value="entry">Entrada</option>
              <option value="exit">Saída</option>
              <option value="adjustment_in">Ajuste positivo</option>
              <option value="adjustment_out">Ajuste negativo</option>
              <option value="loss">Perda</option>
              <option value="return_in">Devolução recebida</option>
            </select>
          </label>
          <label>
            Quantidade
            <input name="quantity" type="number" min="0.000001" step="0.001" required />
          </label>
          {product?.controlsLot && (
            <label>
              Lote
              <select name="lotId" required>
                <option value="">Selecione</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lotNumber}
                    {lot.expiresAt ? ` · val. ${date(lot.expiresAt)}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Custo unitário
            <input name="unitCost" type="number" min="0" step="0.0001" />
          </label>
          <label className="wide-field">
            Motivo
            <input
              name="reason"
              minLength={5}
              maxLength={500}
              required
              placeholder="Informe a justificativa da movimentação"
            />
          </label>
          <Actions
            cancel={() => {
              setAdjusting(false);
              setSelectedProduct('');
            }}
            save="Registrar movimentação"
          />
        </form>
      )}
      {creatingLot && (
        <form className="inline-form compact" onSubmit={(event) => void createLot(event)}>
          <label>
            Produto com lote
            <select name="productId" required>
              <option value="">Selecione</option>
              {lookups.products
                .filter(({ controlsLot }) => controlsLot)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.description}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Número do lote
            <input name="lotNumber" required />
          </label>
          <label>
            Fabricação
            <input name="manufacturedAt" type="date" />
          </label>
          <label>
            Validade
            <input name="expiresAt" type="date" />
          </label>
          <Actions cancel={() => setCreatingLot(false)} save="Cadastrar lote" />
        </form>
      )}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Saldo</th>
              <th>Reservado</th>
              <th>Disponível</th>
              <th>Mínimo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {overview.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.code}</strong>
                  <small className="cell-subtitle">{item.description}</small>
                </td>
                <td>{amount(item.quantity)}</td>
                <td>{amount(item.reservedQuantity)}</td>
                <td>{amount(item.availableQuantity)}</td>
                <td>{amount(item.minimumStock)}</td>
                <td>
                  <span className={`stock-status ${item.status}`}>
                    {item.status === 'ok'
                      ? 'Regular'
                      : item.status === 'low'
                        ? 'Baixo'
                        : 'Sem estoque'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {overview.items.length === 0 && <div className="empty-row">Nenhum produto encontrado.</div>}
      </div>
      <section className="movement-section">
        <h2>Lotes e validades</h2>
        <div className="expiry-grid">
          <Metric label="Vencidos" value={lotsOverview.summary.expired} tone="danger" />
          <Metric label="Até 15 dias" value={lotsOverview.summary.within15} tone="danger" />
          <Metric label="16 a 30 dias" value={lotsOverview.summary.within30} tone="warn" />
          <Metric label="31 a 60 dias" value={lotsOverview.summary.within60} />
          <Metric label="61 a 90 dias" value={lotsOverview.summary.within90} />
        </div>
        <form
          className="inline-form compact fefo-form"
          onSubmit={(event) => void previewFefo(event)}
        >
          <label>
            Produto para saída FEFO
            <select name="productId" required>
              <option value="">Selecione</option>
              {lookups.products
                .filter(({ controlsLot }) => controlsLot)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.description}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Quantidade necessária
            <input name="quantity" type="number" min="0.000001" step="0.001" required />
          </label>
          <button className="primary">Sugerir lotes</button>
        </form>
        {fefo && (
          <aside className={`fefo-result ${fefo.fulfilled ? 'fulfilled' : 'shortage'}`}>
            <strong>Separação FEFO · {fefo.product.description}</strong>
            {fefo.allocations.map((allocation) => (
              <span key={allocation.lotId}>
                Lote {allocation.lotNumber}: <b>{amount(allocation.quantity)}</b>
                {allocation.expiresAt ? ` · validade ${date(allocation.expiresAt)}` : ''}
              </span>
            ))}
            {!fefo.fulfilled && (
              <span>
                Falta: <b>{amount(fefo.shortageQuantity)}</b>
              </span>
            )}
            <small>{fefo.warning}</small>
          </aside>
        )}
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Lote</th>
                <th>Fabricação</th>
                <th>Validade</th>
                <th>Disponível</th>
                <th>Alerta</th>
              </tr>
            </thead>
            <tbody>
              {lotsOverview.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.productCode} · {item.productDescription}
                  </td>
                  <td>
                    <strong>{item.lotNumber}</strong>
                  </td>
                  <td>{item.manufacturedAt ? date(item.manufacturedAt) : '—'}</td>
                  <td>{item.expiresAt ? date(item.expiresAt) : 'Sem validade'}</td>
                  <td>{amount(item.availableQuantity)}</td>
                  <td>
                    <span className={`expiry-status expiry-${item.status}`}>
                      {expiryLabel(item.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lotsOverview.items.length === 0 && (
            <div className="empty-row">Nenhum lote com saldo disponível.</div>
          )}
        </div>
      </section>
      {canReadMovements && (
        <section className="movement-section">
          <h2>Últimas movimentações</h2>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Responsável</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Localização</th>
                  <th>Lote</th>
                </tr>
              </thead>
              <tbody>
                {movements.items.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.occurredAt).toLocaleString('pt-BR')}</td>
                    <td>{item.actor?.displayName ?? 'Sistema'}</td>
                    <td>
                      {item.product
                        ? `${item.product.code} · ${item.product.description}`
                        : item.productId}
                    </td>
                    <td>{movementLabels[item.movementType] ?? item.movementType}</td>
                    <td
                      className={Number(item.quantity) < 0 ? 'negative-amount' : 'positive-amount'}
                    >
                      {Number(item.quantity) > 0 ? '+' : ''}
                      {amount(item.quantity)}
                    </td>
                    <td>{item.location?.name ?? '—'}</td>
                    <td>{item.lot?.lotNumber ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.items.length === 0 && (
              <div className="empty-row">Nenhuma movimentação registrada.</div>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

function Metric({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return (
    <article className={`metric-card stock-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function Actions({ cancel, save }: { cancel: () => void; save: string }) {
  return (
    <div className="form-actions">
      <button type="button" className="quiet" onClick={cancel}>
        Cancelar
      </button>
      <button className="primary">{save}</button>
    </div>
  );
}
function text(data: FormData, name: string): string | null {
  const value = data.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function amount(value: string): string {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 6,
  });
}
function date(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}
function expiryLabel(status: string): string {
  return (
    (
      {
        expired: 'Vencido',
        '15': 'Até 15 dias',
        '30': 'Até 30 dias',
        '60': 'Até 60 dias',
        '90': 'Até 90 dias',
        valid: 'Regular',
        none: 'Sem validade',
      } as Record<string, string>
    )[status] ?? status
  );
}
