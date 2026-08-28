import { useEffect, useMemo, useState } from 'react';
import type {
  PageResult,
  PurchaseSuggestionDetail,
  PurchaseSuggestionSummary,
} from '@erp/contracts';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

const horizons = [7, 15, 30, 45, 60];

export function PurchaseSuggestionPanel({ canCalculate }: { canCalculate: boolean }) {
  const [history, setHistory] = useState<PageResult<PurchaseSuggestionSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [detail, setDetail] = useState<PurchaseSuggestionDetail | null>(null);
  const [horizon, setHorizon] = useState('30');
  const [customDays, setCustomDays] = useState(75);
  const [historyDays, setHistoryDays] = useState(90);
  const [onlySuggested, setOnlySuggested] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadHistory() {
    try {
      setHistory(await apiRequest<PageResult<PurchaseSuggestionSummary>>('/purchases/suggestions'));
    } catch (reason) {
      setError(message(reason));
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function calculate() {
    const forecastDays = horizon === 'custom' ? customDays : Number(horizon);
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<PurchaseSuggestionDetail>(
        '/purchases/suggestions/calculate',
        {
          method: 'POST',
          body: JSON.stringify({ forecastDays, historyDays }),
        },
      );
      setDetail(result);
      await loadHistory();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setLoading(false);
    }
  }

  async function open(id: string) {
    setError('');
    try {
      setDetail(await apiRequest<PurchaseSuggestionDetail>(`/purchases/suggestions/${id}`));
    } catch (reason) {
      setError(message(reason));
    }
  }

  const visibleItems = useMemo(
    () =>
      detail?.items.filter((item) => !onlySuggested || Number(item.suggestedQuantity) > 0) ?? [],
    [detail, onlySuggested],
  );
  const noConsumptionItems =
    detail?.items.filter((item) => Number(item.averageDailySales) === 0).length ?? 0;
  const criticalItems =
    detail?.items.filter(
      (item) =>
        Number(item.availableStock) <= Number(item.explanation.minimumStock) &&
        Number(item.suggestedQuantity) > 0,
    ).length ?? 0;

  return (
    <section>
      <PageHeader
        title="Sugestão inteligente de compra"
        description="Projete reposições com demanda, cobertura, estoque, compras abertas, sazonalidade e prazo do fornecedor."
      />
      {error && <div className="error">{error}</div>}
      {canCalculate && (
        <section className="suggestion-controls">
          <div>
            <span className="eyebrow">HORIZONTE DE PREVISÃO</span>
            <h2>Planejar a próxima compra</h2>
            <p>O cálculo cria uma fotografia auditável; não gera pedido automaticamente.</p>
          </div>
          <label>
            Período
            <select value={horizon} onChange={(event) => setHorizon(event.target.value)}>
              {horizons.map((days) => (
                <option key={days} value={days}>
                  {days} dias
                </option>
              ))}
              <option value="custom">Personalizado</option>
            </select>
          </label>
          {horizon === 'custom' && (
            <label>
              Dias previstos
              <input
                type="number"
                min={1}
                max={180}
                value={customDays}
                onChange={(event) => setCustomDays(Number(event.target.value))}
              />
            </label>
          )}
          <label>
            Histórico analisado
            <select
              value={historyDays}
              onChange={(event) => setHistoryDays(Number(event.target.value))}
            >
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
              <option value={180}>180 dias</option>
              <option value={365}>365 dias</option>
            </select>
          </label>
          <button className="primary" disabled={loading} onClick={() => void calculate()}>
            {loading ? 'Calculando…' : 'Calcular sugestão'}
          </button>
        </section>
      )}

      {detail && (
        <section className="suggestion-result">
          <div className="metric-grid suggestion-metrics">
            <article className="metric-card">
              <span>Horizonte</span>
              <strong>{detail.forecastDays} dias</strong>
              <small>Histórico de {detail.parameters.historyDays} dias</small>
            </article>
            <article className="metric-card">
              <span>Produtos sugeridos</span>
              <strong>{detail.totalSuggestedItems}</strong>
              <small>de {detail.itemCount} produtos analisados</small>
            </article>
            <article className="metric-card">
              <span>Sem consumo histórico</span>
              <strong>{noConsumptionItems}</strong>
              <small>Reposição guiada apenas pelo estoque mínimo</small>
            </article>
            <article className="metric-card danger">
              <span>Abaixo do mínimo</span>
              <strong>{criticalItems}</strong>
              <small>Itens que exigem atenção</small>
            </article>
          </div>
          <header className="result-toolbar">
            <div>
              <span className="stock-status ok">Calculada</span>
              <small>{new Date(detail.calculatedAt).toLocaleString('pt-BR')}</small>
            </div>
            <label className="option">
              <input
                type="checkbox"
                checked={onlySuggested}
                onChange={(event) => setOnlySuggested(event.target.checked)}
              />
              Mostrar apenas itens para comprar
            </label>
          </header>
          <div className="table-card suggestion-table">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Venda/dia</th>
                  <th>Disponível</th>
                  <th>Cobertura</th>
                  <th>Compras abertas</th>
                  <th>Demanda + segurança</th>
                  <th>Sinais</th>
                  <th>Sugestão</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.product.code}</strong>
                      <small className="cell-subtitle">{item.product.description}</small>
                    </td>
                    <td>{number(item.averageDailySales)}</td>
                    <td>{number(item.availableStock)}</td>
                    <td>
                      {item.explanation.daysOfCoverage
                        ? `${number(item.explanation.daysOfCoverage)} dias`
                        : 'Sem consumo'}
                    </td>
                    <td>
                      {number(item.pendingPurchase)}
                      <small className="cell-subtitle">
                        Em trânsito: {number(item.explanation.inTransitPurchase)}
                      </small>
                    </td>
                    <td>
                      {number(Number(item.explanation.forecastDemand) + Number(item.safetyStock))}
                      <small className="cell-subtitle">
                        Alvo: {number(item.explanation.targetStock)} · prazo{' '}
                        {item.explanation.leadDays}d
                      </small>
                    </td>
                    <td>
                      <span className="factor-chip">
                        T {item.explanation.trendFactor.toFixed(2)}×
                      </span>
                      <span className="factor-chip">
                        S {item.explanation.seasonalityFactor.toFixed(2)}×
                      </span>
                    </td>
                    <td>
                      <strong className={Number(item.suggestedQuantity) > 0 ? 'buy-quantity' : ''}>
                        {number(item.suggestedQuantity)}
                      </strong>
                      <small className="cell-subtitle reason-text">{item.explanation.reason}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleItems.length === 0 && (
              <div className="empty-row">Nenhuma compra sugerida para este horizonte.</div>
            )}
          </div>
          <p className="calculation-note">
            T = tendência recente; S = sazonalidade do mesmo período no ano anterior. Fatores são
            limitados para reduzir distorções em históricos pequenos.
          </p>
        </section>
      )}

      <section className="movement-section">
        <h2>Cálculos anteriores</h2>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Calculado em</th>
                <th>Horizonte</th>
                <th>Produtos</th>
                <th>Com sugestão</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.calculatedAt).toLocaleString('pt-BR')}</td>
                  <td>{item.forecastDays} dias</td>
                  <td>{item.itemCount}</td>
                  <td>{item.totalSuggestedItems}</td>
                  <td>
                    <button className="link" onClick={() => void open(item.id)}>
                      Visualizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.items.length === 0 && <div className="empty-row">Nenhum cálculo realizado.</div>}
        </div>
      </section>
    </section>
  );
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Falha ao calcular a sugestão';
}
function number(value: string | number): string {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
