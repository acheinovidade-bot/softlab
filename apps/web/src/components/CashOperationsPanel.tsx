import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

type Operations = {
  totals: { sales: number; gross: string; fees: string; net: string };
  records: Array<{
    id: string;
    number: string;
    soldAt: string;
    status: string;
    origin: string;
    customer: string;
    operator: string;
    total: string;
    feeAmount: string;
    netAmount: string;
    payments: Array<{ method: string; amount: string; installments: number }>;
    fiscal: { type: string; status: string; number: string | null } | null;
  }>;
};
type Tape = {
  totals: { entries: number; inflows: string; outflows: string; balance: string };
  entries: Array<{
    id: string;
    occurredAt: string;
    type: string;
    description: string;
    amount: string;
    direction: 'in' | 'out';
    method: string;
    register: string;
    operator: string;
  }>;
};

export function CashOperationsPanel({ mode }: { mode: 'operations' | 'tape' }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [operations, setOperations] = useState<Operations | null>(null);
  const [tape, setTape] = useState<Tape | null>(null);
  const [error, setError] = useState('');
  async function load() {
    try {
      setError('');
      if (mode === 'operations')
        setOperations(await apiRequest<Operations>(`/cash/operations?from=${from}&to=${to}`));
      else setTape(await apiRequest<Tape>(`/cash/tape?from=${from}&to=${to}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao consultar o caixa');
    }
  }
  useEffect(() => void load(), [mode]);
  const totals = mode === 'operations' ? operations?.totals : tape?.totals;
  return (
    <section>
      <PageHeader
        title={mode === 'operations' ? 'Gerenciar operações do PDV' : 'Fita de caixa'}
        description={
          mode === 'operations'
            ? 'Todas as vendas, pagamentos, taxas e situação fiscal em uma única consulta.'
            : 'Linha cronológica auditável de vendas, suprimentos, pagamentos e sangrias.'
        }
      />
      <form
        className="period-filter"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          Data inicial
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            required
          />
        </label>
        <label>
          Data final
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} required />
        </label>
        <button className="primary">Atualizar</button>
      </form>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {totals && (
        <div className="cash-kpis">
          {mode === 'operations' ? (
            <>
              <article>
                <span>Vendas</span>
                <strong>{(totals as Operations['totals']).sales}</strong>
              </article>
              <article>
                <span>Bruto</span>
                <strong>{money((totals as Operations['totals']).gross)}</strong>
              </article>
              <article>
                <span>Taxas</span>
                <strong>{money((totals as Operations['totals']).fees)}</strong>
              </article>
              <article>
                <span>Líquido</span>
                <strong>{money((totals as Operations['totals']).net)}</strong>
              </article>
            </>
          ) : (
            <>
              <article>
                <span>Movimentos</span>
                <strong>{(totals as Tape['totals']).entries}</strong>
              </article>
              <article>
                <span>Entradas</span>
                <strong>{money((totals as Tape['totals']).inflows)}</strong>
              </article>
              <article>
                <span>Saídas</span>
                <strong>{money((totals as Tape['totals']).outflows)}</strong>
              </article>
              <article>
                <span>Saldo</span>
                <strong>{money((totals as Tape['totals']).balance)}</strong>
              </article>
            </>
          )}
        </div>
      )}
      <div className="table-card cash-operations-table">
        {mode === 'operations' ? (
          <table>
            <thead>
              <tr>
                <th>Venda</th>
                <th>Cliente</th>
                <th>Operador</th>
                <th>Pagamento</th>
                <th>Fiscal</th>
                <th>Bruto</th>
                <th>Líquido</th>
              </tr>
            </thead>
            <tbody>
              {operations?.records.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.number}</strong>
                    <small>
                      {dateTime(item.soldAt)} · {item.origin.toUpperCase()}
                    </small>
                  </td>
                  <td>{item.customer}</td>
                  <td>{item.operator}</td>
                  <td>
                    {item.payments.map((payment) => (
                      <span className="cash-payment-line" key={`${item.id}-${payment.method}`}>
                        {payment.method}
                        {payment.installments > 1 ? ` ${payment.installments}x` : ''} ·{' '}
                        {money(payment.amount)}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className={`badge ${item.fiscal?.status ?? 'pending'}`}>
                      {item.fiscal
                        ? `${item.fiscal.type} · ${fiscalStatusName(item.fiscal.status)}`
                        : 'Não emitido'}
                    </span>
                  </td>
                  <td>
                    {money(item.total)}
                    <small>Taxa {money(item.feeAmount)}</small>
                  </td>
                  <td>
                    <strong>{money(item.netAmount)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Evento</th>
                <th>Caixa</th>
                <th>Operador</th>
                <th>Finalizador</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {tape?.entries.map((item) => (
                <tr key={item.id}>
                  <td>{dateTime(item.occurredAt)}</td>
                  <td>
                    <strong>{typeName(item.type)}</strong>
                    <small>{item.description}</small>
                  </td>
                  <td>{item.register}</td>
                  <td>{item.operator}</td>
                  <td>{item.method}</td>
                  <td className={item.direction === 'out' ? 'cash-out' : 'cash-in'}>
                    {item.direction === 'out' ? '−' : '+'} {money(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(mode === 'operations'
          ? operations?.records.length === 0
          : tape?.entries.length === 0) && (
          <div className="empty-row">Nenhum movimento no período.</div>
        )}
      </div>
    </section>
  );
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}
function typeName(value: string) {
  return (
    (
      {
        opening: 'Abertura',
        receipt: 'Venda recebida',
        payment: 'Pagamento',
        supply: 'Suprimento',
        withdrawal: 'Sangria',
      } as Record<string, string>
    )[value] ?? value
  );
}
function fiscalStatusName(value: string) {
  return (
    (
      {
        authorized: 'Autorizada',
        canceled: 'Cancelada',
        rejected: 'Rejeitada',
        pending: 'Pendente',
      } as Record<string, string>
    )[value] ?? value
  );
}
