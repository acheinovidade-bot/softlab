import { useEffect, useState } from 'react';
import type { CustomerCreditStatement } from '@erp/contracts';
import { apiRequest } from '../api';

export function CustomerStatementPanel({
  customerId,
  paymentMethods,
  canReceive,
  onClose,
}: {
  customerId: string;
  paymentMethods: Array<{ id: string; name: string; type: string }>;
  canReceive: boolean;
  onClose: () => void;
}) {
  const today = new Date();
  const [from, setFrom] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
  );
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [statement, setStatement] = useState<CustomerCreditStatement | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError('');
    try {
      setStatement(
        await apiRequest<CustomerCreditStatement>(
          `/sales/pos/customers/${customerId}/statement?from=${from}&to=${to}`,
        ),
      );
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => void load(), [customerId]);
  async function receive(receivableId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/sales/pos/receivables/${receivableId}/settlements`, {
        method: 'POST',
        body: JSON.stringify({
          amount: form.get('amount'),
          paymentMethodId: form.get('paymentMethodId'),
          idempotencyKey: randomId(),
        }),
      });
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="statement-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Extrato do cliente"
    >
      <section className="statement-panel">
        <header>
          <div>
            <span className="eyebrow">CREDIÁRIO</span>
            <h2>Extrato do cliente</h2>
            {statement && (
              <p>
                {statement.customer.name} · Limite {money(statement.customer.creditLimit)}
              </p>
            )}
          </div>
          <button className="quiet" onClick={onClose}>
            Fechar
          </button>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <form
          className="statement-period"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label>
            Data inicial
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Data final
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button className="primary" disabled={busy}>
            Consultar
          </button>
        </form>
        {statement && (
          <>
            <div className="statement-totals">
              <article>
                <span>Compras no período</span>
                <strong>{money(statement.totalPurchased)}</strong>
              </article>
              <article>
                <span>Recebido no período</span>
                <strong>{money(statement.totalPaid)}</strong>
              </article>
              <article className="due">
                <span>Total em aberto</span>
                <strong>{money(statement.totalDue)}</strong>
              </article>
            </div>
            <div className="statement-coupons">
              {statement.coupons.map((coupon) => (
                <article key={coupon.saleId}>
                  <header>
                    <div>
                      <strong>{coupon.saleNumber}</strong>
                      <span>{dateTime(coupon.soldAt)}</span>
                    </div>
                    <strong>{money(coupon.total)}</strong>
                  </header>
                  <div className="statement-items">
                    {coupon.items.map((item, index) => (
                      <div key={`${item.description}-${index}`}>
                        <span>
                          {number(item.quantity)} × {item.description}
                        </span>
                        <span>{money(item.total)}</span>
                      </div>
                    ))}
                  </div>
                  <footer>
                    <span>Valor desta venda em aberto</span>
                    <strong>{money(coupon.amountDue)}</strong>
                  </footer>
                  {canReceive && coupon.receivableId && Number(coupon.amountDue) > 0 && (
                    <form
                      className="statement-payment"
                      onSubmit={(event) => void receive(coupon.receivableId!, event)}
                    >
                      <select name="paymentMethodId" required>
                        <option value="">Forma de recebimento</option>
                        {paymentMethods
                          .filter(({ type }) => type !== 'credit_account')
                          .map((method) => (
                            <option key={method.id} value={method.id}>
                              {method.name}
                            </option>
                          ))}
                      </select>
                      <input
                        name="amount"
                        aria-label={`Pagamento de ${coupon.saleNumber}`}
                        type="number"
                        min="0.01"
                        max={coupon.amountDue}
                        step="0.01"
                        defaultValue={Number(coupon.amountDue).toFixed(2)}
                        required
                      />
                      <button className="primary" disabled={busy}>
                        Receber parcial
                      </button>
                    </form>
                  )}
                </article>
              ))}
              {statement.coupons.length === 0 && (
                <p className="muted">Nenhuma compra no período selecionado.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function number(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}
function randomId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '018f4f12-2222-7222-8222-333333333333';
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha ao consultar o extrato';
}
