import { useEffect, useState } from 'react';
import type { PosCheckoutResult } from '@erp/contracts';
import QRCode from 'qrcode';
import { apiRequest } from '../api';

export type ReceiptLine = {
  code?: string | undefined;
  description: string;
  unit?: string | undefined;
  quantity: number;
  unitPrice: number;
  total: number;
};
export type SaleReceipt = PosCheckoutResult & {
  customerName?: string | undefined;
  sellerName?: string | undefined;
  lines: ReceiptLine[];
  payments: Array<{ name: string; amount: number; netAmount?: number }>;
};
type FiscalDocument = {
  accessKey: string;
  protocol: string;
  series: string;
  number: string;
  issuedAt: string;
  qrCodeUrl: string;
  total: string;
};

export function SaleCompletionDialog({
  receipt,
  onNext,
}: {
  receipt: SaleReceipt;
  onNext: () => void;
}) {
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState('');
  async function fiscal() {
    if (receipt.offlinePending) {
      setError('A NFC-e ficará disponível após a venda sincronizar com o servidor.');
      return false;
    }
    setIssuing(true);
    setError('');
    try {
      const document = await apiRequest<FiscalDocument>(`/fiscal/nfce/${receipt.saleId}/issue`, {
        method: 'POST',
        body: '{}',
      });
      await print80mm(receipt, document);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível emitir a NFC-e');
      return false;
    } finally {
      setIssuing(false);
    }
  }
  async function fiscalAndNext() {
    if (await fiscal()) onNext();
  }
  async function orderAndNext() {
    await print80mm(receipt);
    onNext();
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onNext();
      }
      if (event.key === 'F8') {
        event.preventDefault();
        void fiscalAndNext();
      }
      if (event.key === 'F9') {
        event.preventDefault();
        void orderAndNext();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
  return (
    <div
      className="sale-completion-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Venda finalizada"
    >
      <article className="sale-completion">
        <span className="sale-completion-icon">✓</span>
        <p className="eyebrow">PAGAMENTO APROVADO</p>
        <h2>{receipt.offlinePending ? 'Venda salva para sincronização' : 'Venda finalizada'}</h2>
        <strong className="sale-completion-total">{money(receipt.total)}</strong>
        <p>
          {receipt.saleNumber} · {receipt.itemCount} itens
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="sale-completion-actions">
          <button
            className="primary"
            onClick={() => void fiscalAndNext()}
            disabled={issuing || receipt.offlinePending}
          >
            <kbd>F8</kbd>
            <span>
              {issuing ? 'Emitindo…' : 'Emitir NFC-e'}
              <small>Cupom fiscal 80 mm</small>
            </span>
          </button>
          <button className="quiet" onClick={() => void orderAndNext()}>
            <kbd>F9</kbd>
            <span>
              Imprimir pedido<small>Documento não fiscal 80 mm</small>
            </span>
          </button>
          <button className="quiet" onClick={onNext}>
            <kbd>Esc</kbd>
            <span>
              Próxima venda<small>Limpar e continuar</small>
            </span>
          </button>
        </div>
      </article>
    </div>
  );
}

async function print80mm(receipt: SaleReceipt, fiscal?: FiscalDocument) {
  const target = window.open('', '_blank', 'popup,width=420,height=720');
  if (!target) return;
  const qrPayload =
    fiscal?.qrCodeUrl ||
    `ERP-PEDIDO:${receipt.orderNumber};VENDA:${receipt.saleNumber};TOTAL:${receipt.total}`;
  const qrImage = await QRCode.toDataURL(qrPayload, {
    width: 420,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  const rows = receipt.lines
    .map(
      (line) =>
        `<tr><td>${escape(line.code ?? '—')}</td><td>${escape(line.description)}</td><td>${number(line.quantity)}</td><td>${escape(line.unit ?? 'UN')}</td><td>${decimalMoney(line.unitPrice)}</td><td>${decimalMoney(line.total)}</td></tr>`,
    )
    .join('');
  const payments = receipt.payments
    .map(
      (payment) =>
        `<div><span>${escape(payment.name)}${payment.netAmount !== undefined && Math.abs(payment.netAmount - payment.amount) > 0.004 ? `<small>Líquido ${money(payment.netAmount)}</small>` : ''}</span><b>${money(payment.amount)}</b></div>`,
    )
    .join('');
  const displayName = receipt.issuer.tradeName?.trim() || receipt.issuer.legalName;
  const legalName = receipt.issuer.legalName.trim();
  const legalNameLine =
    legalName && legalName !== displayName ? `<p class="legal-name">${escape(legalName)}</p>` : '';
  const issuerHeader = `<header class="issuer"><h1>${escape(displayName)}</h1>${legalNameLine}<p>CNPJ ${escape(taxId(receipt.issuer.taxId))}</p></header>`;
  const totalItems = receipt.lines.reduce((sum, line) => sum + line.quantity, 0);
  const fiscalDetails = fiscal
    ? `<section class="fiscal-details"><p>Consulte pela chave de acesso em<br><b>https://www.nfe.fazenda.gov.br/portal</b></p><p class="key">${groupAccessKey(fiscal.accessKey)}</p><div class="fiscal-grid"><img class="qr" src="${escape(qrImage)}" alt="QR Code NFC-e"><div><b>${receipt.customerName ? escape(receipt.customerName) : 'CONSUMIDOR NÃO IDENTIFICADO'}</b><small>Protocolo de autorização:</small><span>${escape(fiscal.protocol)}</span><small>NFC-e nº ${escape(fiscal.number)} · Série ${escape(fiscal.series)}</small><small>Emissão: ${dateTime(fiscal.issuedAt)}</small></div></div><p>Tributos incidentes: consulte o XML autorizado.</p></section>`
    : `<section class="fiscal-details"><div class="fiscal-grid"><img class="qr" src="${escape(qrImage)}" alt="QR Code do pedido"><div><b>DOCUMENTO NÃO FISCAL</b><small>Pedido ${escape(receipt.orderNumber)}</small><small>Venda ${escape(receipt.saleNumber)}</small><small>${receipt.customerName ? `Cliente: ${escape(receipt.customerName)}` : 'Consumidor não identificado'}</small></div></div><p>QR Code para identificação e conferência do pedido.</p></section>`;
  target.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${fiscal ? 'DANFE NFC-e' : 'Pedido de venda'}</title><style>@page{size:80mm auto;margin:1.5mm}*{box-sizing:border-box}body{width:76mm;margin:0 auto;padding:1mm;font:9.5px/1.2 Arial,sans-serif;color:#000}h1,h2,p{margin:2px 0;text-align:center}.issuer h1{font-size:15px;line-height:1.1;text-transform:uppercase}.issuer .legal-name{font-weight:700;text-transform:uppercase}.document-title{font-size:10px;font-weight:700}.dash{border-top:1px dashed #000;margin:4px 0}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5px}th{padding:2px 1px;border-bottom:1px solid #000;text-align:left;white-space:nowrap}td{padding:3px 1px;border-bottom:1px dotted #777;vertical-align:top;overflow-wrap:anywhere}th:nth-child(1),td:nth-child(1){width:11%}th:nth-child(2),td:nth-child(2){width:35%}th:nth-child(3),td:nth-child(3){width:9%;text-align:right}th:nth-child(4),td:nth-child(4){width:8%;text-align:center}th:nth-child(5),td:nth-child(5),th:nth-child(6),td:nth-child(6){width:18.5%;text-align:right}.summary-row,.payment-row{display:flex;justify-content:space-between;margin:2px 0}.summary-row.total{font-size:13px}.payments{margin-top:4px}.payments>div{display:flex;justify-content:space-between}.payments small{display:block}.key{font:9px/1.25 ui-monospace,Consolas,monospace;overflow-wrap:anywhere}.fiscal-grid{display:grid;grid-template-columns:31mm 1fr;gap:3mm;align-items:center;margin:3px 0}.fiscal-grid>div{text-align:center}.fiscal-grid small,.fiscal-grid span{display:block;margin-top:3px}.qr{display:block;width:30mm;height:30mm;object-fit:contain}.non-fiscal{border:1px solid #000;padding:4px;margin:4px 0;text-align:center}.footer{text-align:center;margin-top:4px}@media print{button{display:none}}</style></head><body>${issuerHeader}<p class="document-title">${fiscal ? 'DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA' : 'CUPOM DE PEDIDO DE VENDA'}</p><div class="dash"></div><p>${escape(receipt.saleNumber)} · ${dateTime(receipt.soldAt)}</p><table><thead><tr><th>Cód.</th><th>Descrição</th><th>Qtd.</th><th>Un.</th><th>Vl.Unit.</th><th>Vl.Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary-row"><b>QTD. TOTAL DE ITENS</b><b>${number(totalItems)}</b></div><div class="summary-row total"><b>VALOR TOTAL R$</b><b>${decimalMoney(receipt.total)}</b></div><div class="payments"><b>FORMA DE PAGAMENTO</b>${payments}</div><div class="dash"></div>${fiscalDetails}<p class="footer">Vendedor: ${escape(receipt.sellerName ?? 'Não informado')}</p><script>window.addEventListener('load',()=>{window.print();window.onafterprint=()=>window.close()})</script></body></html>`,
  );
  target.document.close();
}
function escape(value: string | number | null | undefined) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function decimalMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function number(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function taxId(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 14
    ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : value;
}
function groupAccessKey(value: string) {
  return value.replace(/\D/g, '').replace(/(.{4})(?=.)/g, '$1 ');
}
function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}
