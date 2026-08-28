import { useEffect, useState } from 'react';
import type { PublicQuotation } from '@erp/contracts';
import { apiRequest } from '../api';

export function PublicQuotationPage({ token }: { token: string }) {
  const [quotation, setQuotation] = useState<PublicQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    void apiRequest<PublicQuotation>(`/public/quotations/${token}`)
      .then(setQuotation)
      .catch((reason) => setError(message(reason)))
      .finally(() => setLoading(false));
  }, [token]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quotation) return;
    const form = new FormData(event.currentTarget);
    const items = quotation.items.map((item) => ({
      quotationItemId: item.id,
      brand: optional(form, `${item.id}:brand`),
      offeredQuantity: Number(form.get(`${item.id}:quantity`)),
      unitPrice: Number(form.get(`${item.id}:price`)),
      leadDays: optionalNumber(form, `${item.id}:lead`),
      paymentTerms: optional(form, `${item.id}:terms`),
      paymentTermDays: optionalNumber(form, `${item.id}:termDays`),
      notes: optional(form, `${item.id}:notes`),
    }));
    setSaving(true);
    setError('');
    try {
      setQuotation(
        await apiRequest<PublicQuotation>(`/public/quotations/${token}/responses`, {
          method: 'PUT',
          body: JSON.stringify({ items }),
        }),
      );
      setSuccess(true);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <main className="center">
        <div className="loader" aria-label="Carregando cotação" />
      </main>
    );
  if (error && !quotation)
    return (
      <main className="public-quotation">
        <section className="public-message error">
          <h1>Não foi possível abrir a cotação</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  if (!quotation) return null;
  return (
    <main className="public-quotation">
      <header className="public-quote-header">
        <div className="logo">EH</div>
        <div>
          <span className="eyebrow">PORTAL DO FORNECEDOR</span>
          <h1>{quotation.companyName}</h1>
          <p>
            Cotação {quotation.number} · resposta até{' '}
            {new Date(quotation.responseDeadline).toLocaleString('pt-BR')}
          </p>
        </div>
      </header>
      {success && (
        <div className="success-message">
          Proposta salva com sucesso. Você pode atualizá-la até o encerramento do prazo.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <section className="supplier-welcome">
        <h2>Olá, {quotation.supplierName}</h2>
        <p>
          Informe preço, disponibilidade, marca, prazo e condição para cada produto. Nenhum cadastro
          ou senha é necessário.
        </p>
        {quotation.expired && (
          <strong>Esta cotação está encerrada e não aceita novas respostas.</strong>
        )}
      </section>
      <form className="public-response-form" onSubmit={(event) => void submit(event)}>
        {quotation.items.map((item) => (
          <article className="public-response-item" key={item.id}>
            <header>
              <div>
                <strong>{item.product.code}</strong>
                <h2>{item.product.description}</h2>
              </div>
              <span>Solicitado: {number(item.quantity)}</span>
            </header>
            <div className="response-fields">
              <label>
                Quantidade ofertada
                <input
                  name={`${item.id}:quantity`}
                  type="number"
                  min="0"
                  step="0.000001"
                  required
                  defaultValue={item.response?.offeredQuantity ?? item.quantity}
                  disabled={quotation.expired}
                />
              </label>
              <label>
                Preço unitário (R$)
                <input
                  name={`${item.id}:price`}
                  type="number"
                  min="0"
                  step="0.0001"
                  required
                  defaultValue={item.response?.unitPrice ?? ''}
                  disabled={quotation.expired}
                />
              </label>
              <label>
                Marca
                <input
                  name={`${item.id}:brand`}
                  maxLength={120}
                  defaultValue={item.response?.brand ?? ''}
                  disabled={quotation.expired}
                />
              </label>
              <label>
                Prazo de entrega (dias)
                <input
                  name={`${item.id}:lead`}
                  type="number"
                  min="0"
                  max="3650"
                  defaultValue={item.response?.leadDays ?? ''}
                  disabled={quotation.expired}
                />
              </label>
              <label>
                Condição de pagamento
                <input
                  name={`${item.id}:terms`}
                  maxLength={500}
                  placeholder="Ex.: boleto 30/60"
                  defaultValue={item.response?.paymentTerms ?? ''}
                  disabled={quotation.expired}
                />
              </label>
              <label>
                Prazo de pagamento (dias)
                <input
                  name={`${item.id}:termDays`}
                  type="number"
                  min="0"
                  max="3650"
                  defaultValue={item.response?.paymentTermDays ?? ''}
                  disabled={quotation.expired}
                />
              </label>
              <label className="wide-field">
                Observação
                <input
                  name={`${item.id}:notes`}
                  maxLength={2000}
                  defaultValue={item.response?.notes ?? ''}
                  disabled={quotation.expired}
                />
              </label>
            </div>
          </article>
        ))}
        {!quotation.expired && (
          <button className="primary public-submit" disabled={saving}>
            {saving
              ? 'Salvando proposta…'
              : quotation.submitted
                ? 'Atualizar proposta'
                : 'Enviar proposta'}
          </button>
        )}
      </form>
      <footer>Link individual e confidencial. Não encaminhe para terceiros.</footer>
    </main>
  );
}
function optional(form: FormData, name: string): string | null {
  const entry = form.get(name);
  const value = typeof entry === 'string' ? entry.trim() : '';
  return value || null;
}
function optionalNumber(form: FormData, name: string): number | null {
  const entry = form.get(name);
  const value = typeof entry === 'string' ? entry.trim() : '';
  return value === '' ? null : Number(value);
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha ao enviar a proposta';
}
function number(value: string) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}
