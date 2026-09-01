import { useEffect, useState } from 'react';
import type { CustomerCreditStatement } from '@erp/contracts';
import { apiRequest } from '../api';

export function CustomerStatementPanel({
  customerId,
  paymentMethods,
  issuer,
  canReceive,
  onClose,
}: {
  customerId: string;
  paymentMethods: Array<{ id: string; name: string; type: string }>;
  issuer: { tradeName: string | null; legalName: string; taxId: string };
  canReceive: boolean;
  onClose: () => void;
}) {
  const today = new Date();
  const [from, setFrom] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
  );
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [statement, setStatement] = useState<CustomerCreditStatement | null>(null);
  const [view, setView] = useState<'summary' | 'complete'>('complete');
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
  async function receive(
    receivableId: string,
    coupon: CustomerCreditStatement['coupons'][number],
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    const rawPaymentMethodId = form.get('paymentMethodId');
    const paymentMethodId = typeof rawPaymentMethodId === 'string' ? rawPaymentMethodId : '';
    const paymentMethod = paymentMethods.find(({ id }) => id === paymentMethodId)?.name ??
      'Não informada';
    const printTarget = window.open('', '_blank', 'popup,width=420,height=760');
    setBusy(true);
    setError('');
    try {
      const settlement = await apiRequest<{ settledAt?: string; principalAmount?: string; amount?: string }>(`/sales/pos/receivables/${receivableId}/settlements`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          paymentMethodId,
          idempotencyKey: randomId(),
        }),
      });
      if (printTarget && statement)
        printPaymentReceipt(printTarget, {
          issuer,
          customerName: statement.customer.name,
          coupon,
          paymentMethod,
          paidAmount: Number(settlement.principalAmount ?? settlement.amount ?? amount),
          settledAt: settlement.settledAt ?? new Date().toISOString(),
          purchaseRemaining: Math.max(0, Number(coupon.amountDue) - amount),
          totalOpenAmount: Math.max(0, Number(statement.totalDue) - amount),
        });
      await load();
    } catch (reason) {
      printTarget?.close();
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
            <div className="statement-actions" role="group" aria-label="Opções do extrato">
              <button
                type="button"
                className={view === 'summary' ? 'active' : ''}
                aria-pressed={view === 'summary'}
                onClick={() => setView('summary')}
              >
                Resumido · somente valores
              </button>
              <button
                type="button"
                className={view === 'complete' ? 'active' : ''}
                aria-pressed={view === 'complete'}
                onClick={() => setView('complete')}
              >
                Completo · compras e produtos
              </button>
              <button type="button" className="primary" onClick={() => print80mm(statement, view)}>
                Imprimir extrato 80 mm
              </button>
            </div>
            <div className="statement-last-payment">
              <span>Último pagamento</span>
              {statement.lastPayment ? (
                <div>
                  <strong>{money(statement.lastPayment.amount)}</strong>
                  <span>{dateTime(statement.lastPayment.settledAt)}</span>
                  <small>
                    {statement.lastPayment.account} ·{' '}
                    {accountStatus(statement.lastPayment.accountStatus)}
                  </small>
                </div>
              ) : (
                <strong>Nenhum pagamento registrado</strong>
              )}
            </div>
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
                  {view === 'complete' && (
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
                  )}
                  <footer>
                    <span>Valor desta venda em aberto</span>
                    <strong>{money(coupon.amountDue)}</strong>
                  </footer>
                  {canReceive && coupon.receivableId && Number(coupon.amountDue) > 0 && (
                    <form
                      className="statement-payment"
                      onSubmit={(event) => void receive(coupon.receivableId!, coupon, event)}
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
            {view === 'complete' && statement.settlements?.length > 0 && (
              <section className="statement-settlements">
                <h3>Pagamentos e contas baixadas</h3>
                {statement.settlements.map((settlement) => (
                  <div key={settlement.id}>
                    <span>
                      <strong>{settlement.account}</strong>
                      <small>
                        {dateTime(settlement.settledAt)} · {accountStatus(settlement.accountStatus)}
                      </small>
                    </span>
                    <strong>{money(settlement.amount)}</strong>
                  </div>
                ))}
              </section>
            )}
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

function accountStatus(value: string) {
  if (value === 'paid') return 'Quitada';
  if (value === 'partial') return 'Pagamento parcial';
  if (value === 'open') return 'Em aberto';
  return value;
}

function print80mm(statement: CustomerCreditStatement, view: 'summary' | 'complete') {
  const target = window.open('', '_blank', 'popup,width=420,height=760');
  if (!target) return;
  const coupons = statement.coupons
    .map((coupon) => {
      const items =
        view === 'complete'
          ? coupon.items
              .map(
                (item) =>
                  `<div class="row item"><span>${number(item.quantity)}x ${escapeHtml(item.description)}</span><b>${money(item.total)}</b></div>`,
              )
              .join('')
          : '';
      return `<section><div class="row"><b>${escapeHtml(coupon.saleNumber)}</b><span>${dateTime(coupon.soldAt)}</span></div>${items}<div class="row"><span>Total da compra</span><b>${money(coupon.total)}</b></div><div class="row due"><span>Em aberto</span><b>${money(coupon.amountDue)}</b></div></section>`;
    })
    .join('');
  const last = statement.lastPayment
    ? `<p><b>ÚLTIMO PAGAMENTO</b><br>${dateTime(statement.lastPayment.settledAt)}<br>${escapeHtml(statement.lastPayment.account)}<br><b>${money(statement.lastPayment.amount)}</b></p>`
    : '<p><b>ÚLTIMO PAGAMENTO</b><br>Nenhum pagamento registrado</p>';
  const settlements =
    view === 'complete' && statement.settlements?.length
      ? `<h3>CONTAS BAIXADAS</h3>${statement.settlements
          .map(
            (item) =>
              `<div class="row"><span>${escapeHtml(item.account)}<small>${dateTime(item.settledAt)}</small></span><b>${money(item.amount)}</b></div>`,
          )
          .join('')}`
      : '';
  target.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Extrato do cliente</title><style>@page{size:80mm auto;margin:2mm}*{box-sizing:border-box}body{width:74mm;margin:0 auto;font:10px/1.3 Arial,sans-serif;color:#000}h1,h2,h3,p{text-align:center;margin:5px 0}h1{font-size:15px}h2{font-size:12px;border-block:1px dashed;padding:5px}.row{display:flex;justify-content:space-between;gap:5px;padding:4px 0;border-bottom:1px dashed #777}.row>span:first-child{max-width:52mm}.row small{display:block}.item{font-size:9px}.due{font-size:11px}.totals{margin:6px 0;padding:5px;border:1px solid}.totals .row:last-child{font-size:13px;border:0}section{margin:7px 0}</style></head><body><h1>${escapeHtml(statement.customer.name)}</h1><h2>EXTRATO DE CREDIÁRIO · ${view === 'complete' ? 'COMPLETO' : 'RESUMIDO'}</h2><p>Período: ${new Date(statement.period.from).toLocaleDateString('pt-BR')} a ${new Date(statement.period.to).toLocaleDateString('pt-BR')}</p>${last}<div class="totals"><div class="row"><span>Compras</span><b>${money(statement.totalPurchased)}</b></div><div class="row"><span>Pagamentos</span><b>${money(statement.totalPaid)}</b></div><div class="row"><span>TOTAL EM ABERTO</span><b>${money(statement.totalDue)}</b></div></div>${coupons}${settlements}<p>Impresso em ${new Date().toLocaleString('pt-BR')}</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`,
  );
  target.document.close();
}

function printPaymentReceipt(
  target: Window,
  data: {
    issuer: { tradeName: string | null; legalName: string; taxId: string };
    customerName: string;
    coupon: CustomerCreditStatement['coupons'][number];
    paymentMethod: string;
    paidAmount: number;
    settledAt: string;
    purchaseRemaining: number;
    totalOpenAmount: number;
  },
) {
  const displayName = data.issuer.tradeName?.trim() || data.issuer.legalName;
  const products = data.coupon.items
    .map(
      (item) =>
        `<div class="row item"><span>${number(item.quantity)}x ${escapeHtml(item.description)}</span><b>${money(item.total)}</b></div>`,
    )
    .join('');
  target.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Recibo de pagamento</title><style>@page{size:80mm auto;margin:2mm}*{box-sizing:border-box}body{width:74mm;margin:0 auto;font:10px/1.3 Arial,sans-serif;color:#000}h1,h2,h3,p{text-align:center;margin:4px 0}h1{font-size:15px}h2{font-size:12px;border-block:1px dashed;padding:5px}.row{display:flex;justify-content:space-between;gap:5px;padding:4px 0;border-bottom:1px dashed #777}.row>span:first-child{max-width:51mm}.item{font-size:9px}.paid{margin:7px 0;padding:6px;border:2px solid #000;font-size:13px}.remaining{font-size:11px;font-weight:700}.signature{margin-top:18px;padding-top:4px;border-top:1px solid;text-align:center}</style></head><body><h1>${escapeHtml(displayName)}</h1>${data.issuer.legalName !== displayName ? `<p>${escapeHtml(data.issuer.legalName)}</p>` : ''}<p>CNPJ ${escapeHtml(formatTaxId(data.issuer.taxId))}</p><h2>RECIBO DE PAGAMENTO · CREDIÁRIO</h2><p><b>Cliente:</b> ${escapeHtml(data.customerName)}</p><p>${dateTime(data.settledAt)} · ${escapeHtml(data.paymentMethod)}</p><h3>COMPRA BAIXADA</h3><div class="row"><b>${escapeHtml(data.coupon.saleNumber)}</b><span>${dateTime(data.coupon.soldAt)}</span></div>${products}<div class="row"><span>Valor da compra</span><b>${money(data.coupon.total)}</b></div><div class="row"><span>Saldo antes do pagamento</span><b>${money(data.coupon.amountDue)}</b></div><div class="row paid"><span>VALOR PAGO</span><b>${money(data.paidAmount)}</b></div><div class="row"><span>Saldo desta compra</span><b>${money(data.purchaseRemaining)}</b></div><div class="row remaining"><span>TOTAL EM ABERTO DO CLIENTE</span><b>${money(data.totalOpenAmount)}</b></div><p>${data.purchaseRemaining === 0 ? 'COMPRA QUITADA' : 'PAGAMENTO PARCIAL'}</p><p class="signature">Recebemos de ${escapeHtml(data.customerName)} o valor acima indicado.</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`,
  );
  target.document.close();
}

function formatTaxId(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 14
    ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : value;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ??
      character,
  );
}
