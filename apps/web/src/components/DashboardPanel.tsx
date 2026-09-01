import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api';

type SeriesItem = { label: string; value: string; count: number };
type Dashboard = {
  updatedAt: string;
  metrics: {
    todayGross: string;
    todaySales: number;
    monthGross: string;
    monthSales: number;
    averageTicket: string;
    pendingOrders: number;
    openReceivables: string;
    lowStockProducts: number;
  };
  daily: SeriesItem[];
  monthly: SeriesItem[];
  topProducts: Array<{
    productId: string;
    code: string;
    description: string;
    quantity: string;
    total: string;
    sales: number;
  }>;
  noSalesProducts: Array<{ id: string; code: string; description: string }>;
  topCreditCustomers: Array<{
    customerId: string;
    name: string;
    purchased: string;
    openAmount: string;
    purchases: number;
  }>;
};

export function DashboardPanel({ onOpenOrders }: { onOpenOrders: () => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [error, setError] = useState('');
  useEffect(() => {
    void apiRequest<Dashboard>('/cash/dashboard')
      .then(setData)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Falha ao carregar indicadores'),
      );
  }, []);
  const series = data?.[period] ?? [];
  const maximum = useMemo(() => Math.max(...series.map(({ value }) => Number(value)), 1), [series]);

  return (
    <section className="bi-dashboard">
      <header className="bi-header">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h1>Painel de desempenho</h1>
          <p>Indicadores comerciais, financeiros e operacionais atualizados em tempo real.</p>
        </div>
        <div className="bi-live">
          <i /> Dados atualizados {data ? time(data.updatedAt) : 'agora'}
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      {data && (
        <>
          <div className="bi-metrics">
            <Metric
              label="Vendas de hoje"
              value={money(data.metrics.todayGross)}
              detail={`${data.metrics.todaySales} venda(s)`}
              tone="teal"
            />
            <Metric
              label="Faturamento mensal"
              value={money(data.metrics.monthGross)}
              detail={`${data.metrics.monthSales} venda(s)`}
              tone="blue"
            />
            <Metric
              label="Ticket médio"
              value={money(data.metrics.averageTicket)}
              detail="Média do mês"
              tone="purple"
            />
            <Metric
              label="Contas a receber"
              value={money(data.metrics.openReceivables)}
              detail="Saldo em aberto"
              tone="orange"
            />
          </div>
          <div className="bi-layout">
            <article className="bi-chart-card">
              <header>
                <div>
                  <span>FATURAMENTO</span>
                  <h2>Comparativo {period === 'daily' ? 'diário' : 'mensal'}</h2>
                </div>
                <div className="bi-period">
                  <button
                    className={period === 'daily' ? 'active' : ''}
                    onClick={() => setPeriod('daily')}
                  >
                    Diário
                  </button>
                  <button
                    className={period === 'monthly' ? 'active' : ''}
                    onClick={() => setPeriod('monthly')}
                  >
                    Mensal
                  </button>
                </div>
              </header>
              <div className="bi-chart" aria-label={`Gráfico comparativo ${period}`}>
                {series.map((item) => (
                  <div
                    className="bi-bar-column"
                    key={item.label}
                    title={`${item.label}: ${money(item.value)}`}
                  >
                    <span>{moneyCompact(item.value)}</span>
                    <div className="bi-bar-track">
                      <i
                        style={{ height: `${Math.max(5, (Number(item.value) / maximum) * 100)}%` }}
                      />
                    </div>
                    <small>{item.label}</small>
                  </div>
                ))}
              </div>
            </article>
            <aside className="bi-attention">
              <header>
                <span>ATENÇÃO OPERACIONAL</span>
                <h2>Pendências importantes</h2>
              </header>
              <button onClick={onOpenOrders}>
                <span className="bi-alert-icon blue">P</span>
                <div>
                  <strong>{data.metrics.pendingOrders} pedidos em andamento</strong>
                  <small>Acompanhar separação e faturamento</small>
                </div>
                <b>›</b>
              </button>
              <button>
                <span className="bi-alert-icon orange">E</span>
                <div>
                  <strong>{data.metrics.lowStockProducts} produtos com estoque baixo</strong>
                  <small>Verificar necessidade de reposição</small>
                </div>
                <b>›</b>
              </button>
              <button>
                <span className="bi-alert-icon green">R$</span>
                <div>
                  <strong>{money(data.metrics.openReceivables)} a receber</strong>
                  <small>Monitorar vencimentos e cobranças</small>
                </div>
                <b>›</b>
              </button>
            </aside>
          </div>
          <div className="bi-rank-grid">
            <article className="bi-ranking">
              <header>
                <div>
                  <span>DESEMPENHO DE PRODUTOS</span>
                  <h2>15 produtos mais vendidos</h2>
                </div>
                <small>Últimos 12 meses</small>
              </header>
              <div className="bi-ranking-list">
                {data.topProducts.map((product, index) => (
                  <div key={product.productId}>
                    <b>{index + 1}</b>
                    <span>
                      <strong>
                        {product.code} · {product.description}
                      </strong>
                      <small>
                        {number(product.quantity)} unidades · {product.sales} venda(s)
                      </small>
                    </span>
                    <em>{money(product.total)}</em>
                  </div>
                ))}
              </div>
            </article>
            <article className="bi-ranking no-sales">
              <header>
                <div>
                  <span>OPORTUNIDADE</span>
                  <h2>Produtos sem venda</h2>
                </div>
                <small>Últimos 12 meses</small>
              </header>
              <div className="bi-ranking-list">
                {data.noSalesProducts.map((product, index) => (
                  <div key={product.id}>
                    <b>{index + 1}</b>
                    <span>
                      <strong>
                        {product.code} · {product.description}
                      </strong>
                      <small>Sem movimentação comercial no período</small>
                    </span>
                    <em>Revisar</em>
                  </div>
                ))}
                {data.noSalesProducts.length === 0 && (
                  <p className="bi-positive">Todos os produtos ativos tiveram vendas.</p>
                )}
              </div>
            </article>
          </div>
          <article className="bi-credit-table">
            <header>
              <div>
                <span>VENDAS A PRAZO</span>
                <h2>10 clientes que mais compram no crediário</h2>
              </div>
              <small>Compras, saldo em aberto e frequência</small>
            </header>
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Posição</th>
                    <th>Cliente</th>
                    <th>Compras a prazo</th>
                    <th>Total comprado</th>
                    <th>Saldo em aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCreditCustomers.map((customer, index) => (
                    <tr key={customer.customerId}>
                      <td>
                        <strong>#{index + 1}</strong>
                      </td>
                      <td>{customer.name}</td>
                      <td>{customer.purchases}</td>
                      <td>
                        <strong>{money(customer.purchased)}</strong>
                      </td>
                      <td>{money(customer.openAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
      {!data && !error && <div className="bi-loading">Carregando indicadores…</div>}
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className={`bi-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function moneyCompact(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
}
function number(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function time(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
