import { useEffect, useState } from 'react';
import type {
  PageResult,
  PurchaseSuggestionSummary,
  QuotationDetail,
  QuotationSummary,
} from '@erp/contracts';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

type Invitation = { quotationSupplierId: string; supplierId: string; publicPath: string };

export function QuotationPanel({
  canManage,
  canSendWhatsapp = false,
}: {
  canManage: boolean;
  canSendWhatsapp?: boolean;
}) {
  const [quotations, setQuotations] = useState<PageResult<QuotationSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [suggestions, setSuggestions] = useState<PageResult<PurchaseSuggestionSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [suggestionId, setSuggestionId] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [nextQuotations, nextSuggestions] = await Promise.all([
        apiRequest<PageResult<QuotationSummary>>('/purchases/quotations'),
        apiRequest<PageResult<PurchaseSuggestionSummary>>('/purchases/suggestions'),
      ]);
      setQuotations(nextQuotations);
      setSuggestions(nextSuggestions);
      if (!suggestionId)
        setSuggestionId(
          nextSuggestions.items.find(
            ({ status, totalSuggestedItems }) => status === 'calculated' && totalSuggestedItems > 0,
          )?.id ?? '',
        );
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function create() {
    if (!suggestionId) return setError('Selecione uma sugestão calculada');
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<QuotationDetail>('/purchases/quotations/from-suggestion', {
        method: 'POST',
        body: JSON.stringify({
          suggestionId,
          responseDeadline: new Date(`${deadline}T23:59:59`).toISOString(),
        }),
      });
      setDetail(result);
      setLinks(
        Object.fromEntries(
          (result.invitations ?? []).map((item) => [item.quotationSupplierId, item.publicPath]),
        ),
      );
      await load();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setLoading(false);
    }
  }
  async function open(id: string) {
    try {
      setDetail(await apiRequest<QuotationDetail>(`/purchases/quotations/${id}`));
      setLinks({});
      setError('');
    } catch (reason) {
      setError(message(reason));
    }
  }
  async function generateLink(quotationSupplierId: string) {
    if (!detail) return;
    try {
      const result = await apiRequest<Invitation>(
        `/purchases/quotations/${detail.id}/suppliers/${quotationSupplierId}/link`,
        { method: 'POST' },
      );
      setLinks((current) => ({ ...current, [quotationSupplierId]: result.publicPath }));
    } catch (reason) {
      setError(message(reason));
    }
  }
  async function copyLink(quotationSupplierId: string) {
    const path = links[quotationSupplierId];
    if (!path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(quotationSupplierId);
    } catch {
      setError('Não foi possível copiar o link; use o compartilhamento pelo WhatsApp.');
    }
  }
  async function sendWhatsapp(quotationSupplierId: string) {
    if (!detail) return;
    setSending(quotationSupplierId);
    setError('');
    try {
      await apiRequest(
        `/integrations/whatsapp/quotations/${detail.id}/suppliers/${quotationSupplierId}/send`,
        { method: 'POST' },
      );
      setCopied(quotationSupplierId);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setSending('');
    }
  }
  const quotable = suggestions.items.filter(
    ({ status, totalSuggestedItems }) => status === 'calculated' && totalSuggestedItems > 0,
  );
  return (
    <section>
      <PageHeader
        title="Cotação inteligente"
        description="Converta uma necessidade em cotação, colete propostas e compare preço, prazo e condição."
      />
      {error && <div className="error">{error}</div>}
      {canManage && (
        <section className="quotation-create">
          <div>
            <span className="eyebrow">NOVA COTAÇÃO</span>
            <h2>Usar sugestão de compra</h2>
            <p>Fornecedores aptos serão selecionados pelos produtos relacionados.</p>
          </div>
          <label>
            Sugestão
            <select value={suggestionId} onChange={(event) => setSuggestionId(event.target.value)}>
              <option value="">Selecionar cálculo</option>
              {quotable.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.calculatedAt).toLocaleDateString('pt-BR')} · {item.forecastDays}{' '}
                  dias · {item.totalSuggestedItems} itens
                </option>
              ))}
            </select>
          </label>
          <label>
            Responder até
            <input
              type="date"
              min={tomorrow()}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={loading || !suggestionId}
            onClick={() => void create()}
          >
            {loading ? 'Criando…' : 'Criar cotação'}
          </button>
        </section>
      )}
      {detail && (
        <section className="quotation-detail">
          <div className="metric-grid">
            <article className="metric-card">
              <span>Cotação</span>
              <strong>{detail.number}</strong>
              <small>Até {new Date(detail.responseDeadline).toLocaleString('pt-BR')}</small>
            </article>
            <article className="metric-card">
              <span>Fornecedores</span>
              <strong>{detail.supplierCount}</strong>
              <small>Selecionados automaticamente</small>
            </article>
            <article className="metric-card">
              <span>Respostas</span>
              <strong>{detail.responseCount}</strong>
              <small>{detail.supplierCount - detail.responseCount} aguardando</small>
            </article>
            <article className="metric-card">
              <span>Economia potencial</span>
              <strong>{money(detail.totalPotentialSavings)}</strong>
              <small>Maior menos menor proposta</small>
            </article>
          </div>
          <h2>Convites e compartilhamento</h2>
          <div className="invitation-grid">
            {detail.suppliers.map((item) => {
              const path = links[item.id];
              const absolute = path ? `${window.location.origin}${path}` : '';
              const phone = digits(item.supplier.phone);
              const whatsapp =
                absolute && phone
                  ? `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! A cotação ${detail.number} está disponível para resposta: ${absolute}`)}`
                  : '';
              return (
                <article className="invitation-card" key={item.id}>
                  <div>
                    <strong>{item.supplier.tradeName ?? item.supplier.legalName}</strong>
                    <span className={`stock-status ${item.status === 'responded' ? 'ok' : 'low'}`}>
                      {item.status === 'responded' ? 'Respondida' : 'Aguardando'}
                    </span>
                  </div>
                  <small>{item.supplier.phone ?? 'Telefone não cadastrado'}</small>
                  {canManage && (
                    <div className="invitation-actions">
                      {canSendWhatsapp && phone && (
                        <button
                          className="primary"
                          disabled={sending === item.id}
                          onClick={() => void sendWhatsapp(item.id)}
                        >
                          {sending === item.id
                            ? 'Enviando…'
                            : copied === item.id && !path
                              ? 'Enviado pelo gateway'
                              : 'Enviar pelo gateway'}
                        </button>
                      )}
                      {!path && (
                        <button className="quiet" onClick={() => void generateLink(item.id)}>
                          Gerar link seguro
                        </button>
                      )}
                      {path && (
                        <button className="quiet" onClick={() => void copyLink(item.id)}>
                          {copied === item.id ? 'Copiado!' : 'Copiar link'}
                        </button>
                      )}
                      {whatsapp && (
                        <a
                          className="whatsapp-button"
                          href={whatsapp}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Compartilhar no WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <h2>Mapa comparativo</h2>
          <div className="table-card comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Fornecedor</th>
                  <th>Oferta</th>
                  <th>Prazo</th>
                  <th>Condição</th>
                  <th>Último preço</th>
                  <th>Destaques</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.flatMap((item) =>
                  item.offers.length
                    ? item.offers.map((offer) => (
                        <tr key={`${item.id}-${offer.quotationSupplierId}`}>
                          <td>
                            <strong>{item.product.code}</strong>
                            <small className="cell-subtitle">
                              {item.product.description} · solicitado {number(item.quantity)}
                            </small>
                          </td>
                          <td>
                            {offer.supplier.tradeName ?? offer.supplier.legalName}
                            <small className="cell-subtitle">
                              {offer.brand ?? 'Marca não informada'}
                            </small>
                          </td>
                          <td>
                            <strong>{money(offer.unitPrice)}</strong>
                            <small className="cell-subtitle">
                              Qtd. {number(offer.offeredQuantity)}
                            </small>
                          </td>
                          <td>{offer.leadDays === null ? '—' : `${offer.leadDays} dias`}</td>
                          <td>
                            {offer.paymentTerms ?? '—'}
                            <small className="cell-subtitle">
                              {offer.paymentTermDays === null
                                ? ''
                                : `${offer.paymentTermDays} dias`}
                            </small>
                          </td>
                          <td>
                            {offer.lastPrice === null ? 'Sem histórico' : money(offer.lastPrice)}
                            {offer.priceChange !== null && (
                              <small
                                className={`cell-subtitle ${Number(offer.priceChange) <= 0 ? 'positive-amount' : 'negative-amount'}`}
                              >
                                {Number(offer.priceChange) <= 0 ? '' : '+'}
                                {money(offer.priceChange)}
                              </small>
                            )}
                          </td>
                          <td>
                            {offer.isLowestPrice && (
                              <span className="comparison-win">Menor preço</span>
                            )}
                            {offer.isShortestLead && (
                              <span className="comparison-win">Menor prazo</span>
                            )}
                            {offer.isBestPaymentTerm && (
                              <span className="comparison-win">Melhor condição</span>
                            )}
                          </td>
                        </tr>
                      ))
                    : [
                        <tr key={item.id}>
                          <td>
                            <strong>{item.product.code}</strong>
                            <small className="cell-subtitle">{item.product.description}</small>
                          </td>
                          <td colSpan={6}>Aguardando propostas</td>
                        </tr>,
                      ],
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="movement-section">
        <h2>Cotações recentes</h2>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Prazo</th>
                <th>Status</th>
                <th>Itens</th>
                <th>Respostas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quotations.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.number}</strong>
                  </td>
                  <td>{new Date(item.responseDeadline).toLocaleString('pt-BR')}</td>
                  <td>
                    <span className={`stock-status ${item.status === 'open' ? 'ok' : 'out'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.itemCount}</td>
                  <td>
                    {item.responseCount}/{item.supplierCount}
                  </td>
                  <td>
                    <button className="link" onClick={() => void open(item.id)}>
                      Comparar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {quotations.items.length === 0 && (
            <div className="empty-row">Nenhuma cotação criada.</div>
          )}
        </div>
      </section>
    </section>
  );
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha na cotação';
}
function number(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function digits(value: string | null) {
  return value?.replace(/\D/g, '') ?? '';
}
function isoDate(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}
function tomorrow() {
  return isoDate(1);
}
function defaultDeadline() {
  return isoDate(7);
}
