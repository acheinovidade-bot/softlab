import { useEffect, useState } from 'react';
import type { PosCheckoutResult } from '@erp/contracts';
import { apiRequest } from '../api';

export type ReceiptLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};
export type SaleReceipt = PosCheckoutResult & {
  customerName?: string | undefined;
  lines: ReceiptLine[];
  payments: Array<{ name: string; amount: number }>;
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
    if (receipt.offlinePending)
      return setError('A NFC-e ficará disponível após a venda sincronizar com o servidor.');
    setIssuing(true);
    setError('');
    try {
      const document = await apiRequest<FiscalDocument>(`/fiscal/nfce/${receipt.saleId}/issue`, {
        method: 'POST',
        body: '{}',
      });
      print80mm(receipt, document);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível emitir a NFC-e');
    } finally {
      setIssuing(false);
    }
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onNext();
      }
      if (event.key === 'F8') {
        event.preventDefault();
        void fiscal();
      }
      if (event.key === 'F9') {
        event.preventDefault();
        print80mm(receipt);
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
            onClick={() => void fiscal()}
            disabled={issuing || receipt.offlinePending}
          >
            <kbd>F8</kbd>
            <span>
              {issuing ? 'Emitindo…' : 'Emitir NFC-e'}
              <small>Cupom fiscal 80 mm</small>
            </span>
          </button>
          <button className="quiet" onClick={() => print80mm(receipt)}>
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

function print80mm(receipt: SaleReceipt, fiscal?: FiscalDocument) {
  const target = window.open('', '_blank', 'popup,width=420,height=720');
  if (!target) return;
  const rows = receipt.lines
    .map(
      (line) =>
        `<tr><td>${escape(line.description)}<small>${number(line.quantity)} × ${money(line.unitPrice)}</small></td><td>${money(line.total)}</td></tr>`,
    )
    .join('');
  const payments = receipt.payments
    .map(
      (payment) => `<div><span>${escape(payment.name)}</span><b>${money(payment.amount)}</b></div>`,
    )
    .join('');
  target.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${fiscal ? 'DANFE NFC-e' : 'Pedido de venda'}</title><style>@page{size:80mm auto;margin:2mm}*{box-sizing:border-box}body{width:72mm;margin:0 auto;font:11px/1.35 ui-monospace,Consolas,monospace;color:#000}h1,p{margin:3px 0;text-align:center}.dash{border-top:1px dashed #000;margin:7px 0}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px dotted #999;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}small{display:block}.total,.payment{display:flex;justify-content:space-between;margin:4px 0}.total{font-size:16px}.key{overflow-wrap:anywhere;text-align:center}.qr{display:block;width:34mm;height:34mm;object-fit:contain;margin:6px auto}@media print{button{display:none}}</style></head><body><h1>${fiscal ? 'DANFE NFC-e' : 'PEDIDO DE VENDA'}</h1><p>${fiscal ? 'Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica' : 'DOCUMENTO NÃO FISCAL'}</p><div class="dash"></div><p>${escape(receipt.saleNumber)}<br>${new Date(receipt.soldAt).toLocaleString('pt-BR')}</p><table>${rows}</table><div class="dash"></div><div class="total"><span>TOTAL</span><b>${money(receipt.total)}</b></div>${payments}<div class="dash"></div>${fiscal ? `<p>NFC-e ${escape(fiscal.series)}/${escape(fiscal.number)}<br>Protocolo ${escape(fiscal.protocol)}</p><p class="key">Chave de acesso<br>${escape(fiscal.accessKey)}</p><img class="qr" src="${escape(fiscal.qrCodeUrl)}" alt="QR Code NFC-e">` : '<p>Sem valor fiscal</p>'}<p>${receipt.customerName ? `Cliente: ${escape(receipt.customerName)}` : 'Consumidor não identificado'}</p><script>window.addEventListener('load',()=>{window.print();window.onafterprint=()=>window.close()})</script></body></html>`,
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
function number(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
