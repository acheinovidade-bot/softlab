import { useEffect, useState } from 'react';
import type {
  BomSummary,
  PageResult,
  ProductionOrderDetail,
  ProductionOrderSummary,
  ProductionStatus,
} from '@erp/contracts';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

type Product = {
  id: string;
  code: string;
  description: string;
  controlsLot: boolean;
  controlsExpiry: boolean;
  unitId: string;
  productType: string;
};
type Lookup = {
  products: Product[];
  units: Array<{ id: string; code: string; name: string }>;
  locations: Array<{ id: string; code: string; name: string }>;
  lots: Array<{
    id: string;
    productId: string;
    lotNumber: string;
    expiresAt: string | null;
    balances: Array<{ locationId: string; availableQuantity: string }>;
  }>;
};
type ComponentDraft = {
  key: number;
  componentProductId: string;
  unitId: string;
  quantity: string;
  lossPercent: string;
};
const stages: ProductionStatus[] = ['planned', 'separation', 'processing', 'quality', 'finalized'];
const stageLabels: Record<ProductionStatus, string> = {
  planned: 'Planejada',
  separation: 'Separação',
  processing: 'Processamento',
  quality: 'Qualidade',
  finalized: 'Finalizada',
};

export function ProductionPanel({
  canEngineer,
  canManage,
  canFinalize,
}: {
  canEngineer: boolean;
  canManage: boolean;
  canFinalize: boolean;
}) {
  const [lookups, setLookups] = useState<Lookup>({
    products: [],
    units: [],
    locations: [],
    lots: [],
  });
  const [boms, setBoms] = useState<BomSummary[]>([]);
  const [orders, setOrders] = useState<PageResult<ProductionOrderSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [detail, setDetail] = useState<ProductionOrderDetail | null>(null);
  const [engineering, setEngineering] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [components, setComponents] = useState<ComponentDraft[]>([
    { key: 1, componentProductId: '', unitId: '', quantity: '1', lossPercent: '0' },
  ]);
  const [locationId, setLocationId] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [nextLookups, nextBoms, nextOrders] = await Promise.all([
        apiRequest<Lookup>('/production/lookups'),
        apiRequest<BomSummary[]>('/production/boms'),
        apiRequest<PageResult<ProductionOrderSummary>>('/production/orders'),
      ]);
      setLookups(nextLookups);
      setBoms(nextBoms);
      setOrders(nextOrders);
      if (!locationId) setLocationId(nextLookups.locations[0]?.id ?? '');
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function createBom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest('/production/boms', {
        method: 'POST',
        body: JSON.stringify({
          productId: form.get('productId'),
          yieldQuantity: form.get('yieldQuantity'),
          expectedLossPercent: form.get('expectedLossPercent'),
          items: components.map(({ componentProductId, unitId, quantity, lossPercent }) => ({
            componentProductId,
            unitId,
            quantity,
            lossPercent,
          })),
        }),
      });
      setEngineering(false);
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const created = await apiRequest<ProductionOrderDetail>('/production/orders', {
        method: 'POST',
        body: JSON.stringify({
          bomId: form.get('bomId'),
          plannedQuantity: form.get('plannedQuantity'),
          plannedAt: new Date(text(form, 'plannedAt') ?? '').toISOString(),
        }),
      });
      setDetail(created);
      setCreatingOrder(false);
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    try {
      setDetail(await apiRequest<ProductionOrderDetail>(`/production/orders/${id}`));
      setError('');
    } catch (reason) {
      setError(message(reason));
    }
  }
  async function advance() {
    if (!detail) return;
    const next = stages[stages.indexOf(detail.status) + 1];
    if (!next || next === 'finalized') return;
    setBusy(true);
    setError('');
    try {
      setDetail(
        await apiRequest<ProductionOrderDetail>(`/production/orders/${detail.id}/transition`, {
          method: 'POST',
          body: JSON.stringify({ toStatus: next, ...(next === 'quality' ? { qualityNotes } : {}) }),
        }),
      );
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  async function finalize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const consumptions = detail.requirements.map((requirement) => ({
        productId: requirement.productId,
        lotId: text(form, `lot-${requirement.productId}`),
        quantity: text(form, `quantity-${requirement.productId}`),
        lossQuantity: text(form, `loss-${requirement.productId}`) ?? '0',
      }));
      const finished = await apiRequest<ProductionOrderDetail>(
        `/production/orders/${detail.id}/finalize`,
        {
          method: 'POST',
          body: JSON.stringify({
            locationId,
            producedQuantity: form.get('producedQuantity'),
            lotNumber: form.get('lotNumber'),
            manufacturedAt: form.get('manufacturedAt'),
            expiresAt: text(form, 'expiresAt'),
            qualityNotes: text(form, 'qualityNotes'),
            consumptions,
          }),
        },
      );
      setDetail(finished);
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  function changeComponent(key: number, field: keyof Omit<ComponentDraft, 'key'>, value: string) {
    setComponents((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]: value,
              ...(field === 'componentProductId'
                ? { unitId: lookups.products.find(({ id }) => id === value)?.unitId ?? '' }
                : {}),
            }
          : item,
      ),
    );
  }
  const activeBoms = boms.filter(({ active }) => active);
  const manufactured = lookups.products.filter(({ productType }) => productType === 'manufactured');
  return (
    <section>
      <PageHeader
        title="Produção"
        description="Engenharia, separação, processamento, qualidade e entrada rastreável do produto acabado."
        action={canEngineer ? () => setEngineering(true) : undefined}
      />
      {error && <div className="error">{error}</div>}
      <div className="production-toolbar">
        {canManage && (
          <button className="primary" onClick={() => setCreatingOrder(true)}>
            + Nova ordem
          </button>
        )}
        <span>
          {activeBoms.length} fichas técnicas ativas · {orders.total} ordens
        </span>
      </div>
      {engineering && (
        <form className="production-form" onSubmit={(event) => void createBom(event)}>
          <header>
            <div>
              <span className="eyebrow">ENGENHARIA DE PRODUTO</span>
              <h2>Nova versão de ficha técnica</h2>
            </div>
          </header>
          <div className="inline-form compact">
            <label>
              Produto acabado
              <select name="productId" required>
                <option value="">Selecione</option>
                {manufactured.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.description}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rendimento da receita
              <input
                name="yieldQuantity"
                type="number"
                min="0.000001"
                step="0.001"
                defaultValue="1"
                required
              />
            </label>
            <label>
              Perda geral estimada %
              <input
                name="expectedLossPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue="0"
                required
              />
            </label>
          </div>
          <h3>Ingredientes e componentes</h3>
          {components.map((item) => (
            <div className="bom-component" key={item.key}>
              <select
                aria-label="Componente"
                required
                value={item.componentProductId}
                onChange={(event) =>
                  changeComponent(item.key, 'componentProductId', event.target.value)
                }
              >
                <option value="">Produto componente</option>
                {lookups.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} · {product.description}
                  </option>
                ))}
              </select>
              <select
                aria-label="Unidade"
                required
                value={item.unitId}
                onChange={(event) => changeComponent(item.key, 'unitId', event.target.value)}
              >
                <option value="">Unidade</option>
                {lookups.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code}
                  </option>
                ))}
              </select>
              <input
                aria-label="Quantidade"
                type="number"
                min="0.000001"
                step="0.001"
                value={item.quantity}
                onChange={(event) => changeComponent(item.key, 'quantity', event.target.value)}
              />
              <input
                aria-label="Perda percentual"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={item.lossPercent}
                onChange={(event) => changeComponent(item.key, 'lossPercent', event.target.value)}
              />
              <button
                type="button"
                className="link"
                disabled={components.length === 1}
                onClick={() =>
                  setComponents((current) => current.filter(({ key }) => key !== item.key))
                }
              >
                Remover
              </button>
            </div>
          ))}
          <div className="form-actions">
            <button
              type="button"
              className="quiet"
              onClick={() =>
                setComponents((current) => [
                  ...current,
                  {
                    key: Math.max(...current.map(({ key }) => key)) + 1,
                    componentProductId: '',
                    unitId: '',
                    quantity: '1',
                    lossPercent: '0',
                  },
                ])
              }
            >
              + Componente
            </button>
            <button type="button" className="quiet" onClick={() => setEngineering(false)}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              Salvar nova versão
            </button>
          </div>
        </form>
      )}
      {creatingOrder && (
        <form className="inline-form" onSubmit={(event) => void createOrder(event)}>
          <label>
            Ficha técnica
            <select name="bomId" required>
              <option value="">Selecione</option>
              {activeBoms.map((bom) => (
                <option key={bom.id} value={bom.id}>
                  {bom.product.code} · {bom.product.description} · v{bom.version}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantidade planejada
            <input name="plannedQuantity" type="number" min="0.000001" step="0.001" required />
          </label>
          <label>
            Planejada para
            <input name="plannedAt" type="datetime-local" defaultValue={localDate()} required />
          </label>
          <div className="form-actions">
            <button type="button" className="quiet" onClick={() => setCreatingOrder(false)}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              Criar ordem
            </button>
          </div>
        </form>
      )}
      {detail && (
        <section className="production-detail">
          <header>
            <div>
              <span className="eyebrow">{detail.number}</span>
              <h2>
                {detail.product.code} · {detail.product.description}
              </h2>
              <p>
                Planejado {number(detail.plannedQuantity)} · produzido{' '}
                {number(detail.producedQuantity)}
              </p>
            </div>
            <button className="quiet" onClick={() => setDetail(null)}>
              Fechar
            </button>
          </header>
          <div className="production-flow">
            {stages.map((stage, index) => (
              <div key={stage} className={index <= stages.indexOf(detail.status) ? 'complete' : ''}>
                <span>{index + 1}</span>
                <strong>{stageLabels[stage]}</strong>
              </div>
            ))}
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Previsto</th>
                  <th>Perda estimada</th>
                  <th>Disponível</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.requirements.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      {item.product.code} · {item.product.description}
                    </td>
                    <td>{number(item.expectedQuantity)}</td>
                    <td>{number(item.expectedLossQuantity)}</td>
                    <td>{number(item.availableQuantity)}</td>
                    <td>
                      <span className={`stock-status ${item.sufficient ? 'ok' : 'out'}`}>
                        {item.sufficient ? 'Disponível' : 'Insuficiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canManage && !['quality', 'finalized'].includes(detail.status) && (
            <div className="production-next">
              {detail.status === 'processing' && (
                <label>
                  Conferência antes da qualidade
                  <textarea
                    value={qualityNotes}
                    onChange={(event) => setQualityNotes(event.target.value)}
                    required
                  />
                </label>
              )}
              <button
                className="primary"
                disabled={busy || (detail.status === 'processing' && !qualityNotes.trim())}
                onClick={() => void advance()}
              >
                Avançar para {stageLabels[stages[stages.indexOf(detail.status) + 1] ?? 'finalized']}
              </button>
            </div>
          )}
          {detail.status === 'quality' && canFinalize && (
            <form className="production-finalize" onSubmit={(event) => void finalize(event)}>
              <h3>Apontamento final</h3>
              <div className="inline-form">
                <label>
                  Local de consumo e entrada
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    {lookups.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} · {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantidade produzida
                  <input
                    name="producedQuantity"
                    type="number"
                    min="0.000001"
                    step="0.001"
                    defaultValue={String(detail.plannedQuantity)}
                    required
                  />
                </label>
                <label>
                  Lote produzido
                  <input name="lotNumber" defaultValue={`OP-${detail.number}`} required />
                </label>
                <label>
                  Fabricação
                  <input
                    name="manufacturedAt"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
                <label>
                  Validade
                  <input name="expiresAt" type="date" />
                </label>
                <label>
                  Qualidade
                  <textarea name="qualityNotes" defaultValue={detail.qualityNotes ?? ''} />
                </label>
              </div>
              <h3>Consumo real e perdas</h3>
              {detail.requirements.map((item) => (
                <div className="consumption-row" key={item.productId}>
                  <strong>
                    {item.product.code} · {item.product.description}
                  </strong>
                  {item.product.controlsLot ? (
                    <select name={`lot-${item.productId}`} required defaultValue="">
                      <option value="">Lote consumido</option>
                      {lookups.lots
                        .filter(
                          (lot) =>
                            lot.productId === item.productId &&
                            lot.balances.some(
                              (balance) =>
                                balance.locationId === locationId &&
                                Number(balance.availableQuantity) > 0,
                            ),
                        )
                        .map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {lot.lotNumber}
                            {lot.expiresAt ? ` · val. ${date(lot.expiresAt)}` : ''}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input type="hidden" name={`lot-${item.productId}`} value="" />
                  )}
                  <label>
                    Consumo
                    <input
                      name={`quantity-${item.productId}`}
                      type="number"
                      min="0.000001"
                      step="0.001"
                      defaultValue={String(item.expectedQuantity)}
                      required
                    />
                  </label>
                  <label>
                    Perda
                    <input
                      name={`loss-${item.productId}`}
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue={String(item.expectedLossQuantity)}
                      required
                    />
                  </label>
                </div>
              ))}
              <div className="form-actions">
                <button className="primary" disabled={busy}>
                  Finalizar e movimentar estoque
                </button>
              </div>
            </form>
          )}
          {detail.status === 'finalized' && (
            <aside className="success-message">
              Produção finalizada em{' '}
              {detail.finishedAt ? new Date(detail.finishedAt).toLocaleString('pt-BR') : '—'}. Lote{' '}
              {detail.outputs[0]?.lotNumber ?? '—'} lançado no estoque.
            </aside>
          )}
        </section>
      )}
      <section className="movement-section">
        <h2>Ordens de produção</h2>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Produto</th>
                <th>Planejado</th>
                <th>Data</th>
                <th>Etapa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.items.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.number}</strong>
                  </td>
                  <td>
                    {order.product.code} · {order.product.description}
                  </td>
                  <td>{number(order.plannedQuantity)}</td>
                  <td>{new Date(order.plannedAt).toLocaleString('pt-BR')}</td>
                  <td>
                    <span className={`production-status ${order.status}`}>
                      {stageLabels[order.status]}
                    </span>
                  </td>
                  <td>
                    <button className="link" onClick={() => void open(order.id)}>
                      Acompanhar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.items.length === 0 && <div className="empty-row">Nenhuma ordem de produção.</div>}
        </div>
      </section>
    </section>
  );
}
function text(form: FormData, name: string) {
  const raw = form.get(name);
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || null;
}
function number(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function date(value: string) {
  return new Date(value).toLocaleDateString('pt-BR');
}
function localDate() {
  const date = new Date(Date.now() + 3_600_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha na produção';
}
