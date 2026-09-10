import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

type ReportData = {
  metrics: {
    todayGross: string;
    monthGross: string;
    averageTicket: string;
    pendingOrders: number;
    openReceivables: string;
    lowStockProducts: number;
  };
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

export function ReportsPanel({ mode }: { mode: 'summary' | 'customers' | 'products' }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void apiRequest<ReportData>('/cash/dashboard')
      .then(setData)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Falha ao gerar relatório'),
      );
  }, []);
  const title =
    mode === 'summary'
      ? 'Central de relatórios'
      : mode === 'customers'
        ? 'Relatório de clientes'
        : 'Relatório de produtos';
  return (
    <section className="reports-panel">
      <PageHeader
        title={title}
        description="Informações gerenciais prontas para análise, impressão e exportação."
      />
      <div className="reports-toolbar">
        <label>
          Data inicial
          <input type="date" defaultValue={monthStart()} />
        </label>
        <label>
          Data final
          <input type="date" defaultValue={today()} />
        </label>
        <button className="quiet" onClick={() => window.print()}>
          Imprimir
        </button>
        <button className="primary" disabled={!data} onClick={() => data && exportCsv(mode, data)}>
          Exportar CSV
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {data && mode === 'summary' && (
        <>
          <div className="report-catalog">
            {[
              'Vendas por período',
              'Fechamento e fita de caixa',
              'Produtos mais vendidos',
              'Estoque baixo e sem giro',
              'Clientes e crediário',
              'Contas a receber',
            ].map((name, index) => (
              <article key={name}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{name}</strong>
                <small>Relatório operacional atualizado</small>
              </article>
            ))}
          </div>
          <div className="cash-kpis">
            <article>
              <span>Faturamento do mês</span>
              <strong>{money(data.metrics.monthGross)}</strong>
            </article>
            <article>
              <span>Ticket médio</span>
              <strong>{money(data.metrics.averageTicket)}</strong>
            </article>
            <article>
              <span>Pedidos pendentes</span>
              <strong>{data.metrics.pendingOrders}</strong>
            </article>
            <article>
              <span>Contas a receber</span>
              <strong>{money(data.metrics.openReceivables)}</strong>
            </article>
          </div>
        </>
      )}
      {data && mode === 'customers' && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Compras a prazo</th>
                <th>Total comprado</th>
                <th>Saldo em aberto</th>
              </tr>
            </thead>
            <tbody>
              {data.topCreditCustomers.map((item) => (
                <tr key={item.customerId}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.purchases}</td>
                  <td>{money(item.purchased)}</td>
                  <td>{money(item.openAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && mode === 'products' && (
        <div className="reports-product-grid">
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      <strong>{item.code}</strong>
                      <small>{item.description}</small>
                    </td>
                    <td>{number(item.quantity)}</td>
                    <td>{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Produtos sem venda</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.noSalesProducts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.code}</strong>
                      <small>{item.description}</small>
                    </td>
                    <td>
                      <span className="badge pending">Revisar</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function exportCsv(mode: string, data: ReportData) {
  const rows =
    mode === 'customers'
      ? [
          ['Cliente', 'Compras', 'Total', 'Saldo'],
          ...data.topCreditCustomers.map((item) => [
            item.name,
            item.purchases,
            item.purchased,
            item.openAmount,
          ]),
        ]
      : mode === 'products'
        ? [
            ['Código', 'Produto', 'Quantidade', 'Faturamento'],
            ...data.topProducts.map((item) => [
              item.code,
              item.description,
              item.quantity,
              item.total,
            ]),
          ]
        : [
            ['Indicador', 'Valor'],
            ['Faturamento mensal', data.metrics.monthGross],
            ['Ticket médio', data.metrics.averageTicket],
            ['Contas a receber', data.metrics.openReceivables],
          ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';'))
    .join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv' }));
  link.download = `relatorio-${mode}-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function number(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthStart() {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}
