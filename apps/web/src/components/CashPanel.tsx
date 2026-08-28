import { useEffect, useState } from 'react';
import type { CashSessionSummary } from '@erp/contracts';
import { apiRequest } from '../api';

type Overview = {
  registers: Array<{ id: string; code: string; name: string }>;
  paymentMethods: Array<{ id: string; name: string }>;
  sessions: CashSessionSummary[];
};

export function CashPanel({ canOperate, canReopen }: { canOperate: boolean; canReopen: boolean }) {
  const [data, setData] = useState<Overview>({ registers: [], paymentMethods: [], sessions: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const session = data.sessions.find(({ id }) => id === selected) ?? data.sessions[0];
  const open = data.sessions.find(({ status }) => status === 'open');

  async function load() {
    try {
      const overview = await apiRequest<Overview>('/cash/overview');
      setData(overview);
      setSelected((current) => current ?? overview.sessions[0]?.id ?? null);
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => void load(), []);
  async function submit(path: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cash-screen">
      <header className="cash-header">
        <div>
          <span className="eyebrow">CONTROLE FINANCEIRO</span>
          <h1>Caixa diário</h1>
          <p>Abertura, movimentações e conferência por forma de pagamento.</p>
        </div>
        <div className={`cash-state ${open ? 'open' : ''}`}>
          <span>{open ? '● EM OPERAÇÃO' : '○ FECHADO'}</span>
          <strong>{open ? open.register.name : 'Nenhum caixa aberto'}</strong>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!open && canOperate && (
        <form
          className="cash-open card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void submit('/cash/open', {
              registerId: form.get('registerId'),
              openingAmount: form.get('openingAmount'),
            });
          }}
        >
          <div>
            <h2>Abrir turno</h2>
            <p>Informe o fundo de troco para iniciar.</p>
          </div>
          <label>
            Caixa
            <select name="registerId" required>
              <option value="">Selecione</option>
              {data.registers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Saldo inicial
            <input
              name="openingAmount"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0.00"
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            Abrir caixa
          </button>
        </form>
      )}
      {data.registers.length === 0 && canOperate && (
        <form
          className="cash-open card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void submit('/cash/registers', { code: form.get('code'), name: form.get('name') });
          }}
        >
          <div>
            <h2>Primeiro caixa</h2>
            <p>Cadastre um ponto de atendimento nesta filial.</p>
          </div>
          <label>
            Código
            <input name="code" defaultValue="CX-01" required />
          </label>
          <label>
            Nome
            <input name="name" defaultValue="Caixa principal" required />
          </label>
          <button className="primary" disabled={busy}>
            Cadastrar
          </button>
        </form>
      )}
      {open && (
        <div className="cash-grid">
          <main>
            <section className="cash-kpis">
              {open.totals.length ? (
                open.totals.map((total) => (
                  <article key={total.paymentMethodId ?? 'other'}>
                    <span>{total.methodName}</span>
                    <strong>{money(total.amount)}</strong>
                  </article>
                ))
              ) : (
                <article>
                  <span>Saldo inicial</span>
                  <strong>{money(open.openingAmount)}</strong>
                </article>
              )}
            </section>
            {canOperate && (
              <form
                className="cash-movement card"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void submit(`/cash/${open.id}/movements`, {
                    type: form.get('type'),
                    amount: form.get('amount'),
                    paymentMethodId: form.get('paymentMethodId') || null,
                    description: form.get('description'),
                  });
                  event.currentTarget.reset();
                }}
              >
                <h2>Nova movimentação</h2>
                <select name="type">
                  <option value="supply">Suprimento</option>
                  <option value="withdrawal">Sangria</option>
                  <option value="payment">Pagamento</option>
                </select>
                <select name="paymentMethodId">
                  <option value="">Sem forma específica</option>
                  {data.paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  name="amount"
                  aria-label="Valor"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Valor"
                  required
                />
                <input
                  name="description"
                  aria-label="Descrição"
                  placeholder="Descrição / motivo"
                  minLength={3}
                  required
                />
                <button className="primary" disabled={busy}>
                  Registrar
                </button>
              </form>
            )}
            <section className="cash-ledger card">
              <h2>Movimentações</h2>
              {open.movements.map((movement) => (
                <div className="cash-entry" key={movement.id}>
                  <span
                    className={['payment', 'withdrawal'].includes(movement.type) ? 'out' : 'in'}
                  >
                    {['payment', 'withdrawal'].includes(movement.type) ? '−' : '+'}
                  </span>
                  <div>
                    <strong>{label(movement.type)}</strong>
                    <small>
                      {movement.description} · {dateTime(movement.occurredAt)}
                    </small>
                  </div>
                  <strong>{money(movement.amount)}</strong>
                </div>
              ))}
              {open.movements.length === 0 && (
                <p className="muted">Nenhuma movimentação registrada.</p>
              )}
            </section>
          </main>
          {canOperate && (
            <aside className="cash-close card">
              <span className="eyebrow">CONFERÊNCIA</span>
              <h2>Fechamento</h2>
              <p>Digite o valor contado em cada forma.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void submit(`/cash/${open.id}/close`, {
                    counts: data.paymentMethods.map((method) => ({
                      paymentMethodId: method.id,
                      countedAmount: form.get(method.id),
                    })),
                  });
                }}
              >
                {data.paymentMethods.map((method) => {
                  const system =
                    open.totals.find(({ paymentMethodId }) => paymentMethodId === method.id)
                      ?.amount ?? '0';
                  return (
                    <label key={method.id}>
                      <span>
                        {method.name}
                        <small>Sistema {money(system)}</small>
                      </span>
                      <input
                        name={method.id}
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={Number(system).toFixed(2)}
                        required
                      />
                    </label>
                  );
                })}
                <button className="cash-finish" disabled={busy}>
                  Fechar e conferir
                </button>
              </form>
            </aside>
          )}
        </div>
      )}
      <section className="cash-history card">
        <header>
          <h2>Histórico de turnos</h2>
        </header>
        {data.sessions.map((item) => (
          <button
            key={item.id}
            className={session?.id === item.id ? 'selected' : ''}
            onClick={() => setSelected(item.id)}
          >
            <span>
              <strong>{item.register.code}</strong>
              {dateTime(item.openedAt)}
            </span>
            <span className={`cash-badge ${item.status}`}>
              {item.status === 'open' ? 'Aberto' : 'Fechado'}
            </span>
            {item.status === 'closed' && canReopen && (
              <span
                className="link"
                onClick={(event) => {
                  event.stopPropagation();
                  void submit(`/cash/${item.id}/reopen`);
                }}
              >
                Reabrir
              </span>
            )}
          </button>
        ))}
        {data.sessions.length === 0 && <p className="muted">Nenhum turno registrado.</p>}
      </section>
    </section>
  );
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}
function label(value: string) {
  return (
    (
      {
        opening: 'Abertura',
        receipt: 'Recebimento',
        payment: 'Pagamento',
        supply: 'Suprimento',
        withdrawal: 'Sangria',
      } as Record<string, string>
    )[value] ?? value
  );
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha ao operar o caixa';
}
