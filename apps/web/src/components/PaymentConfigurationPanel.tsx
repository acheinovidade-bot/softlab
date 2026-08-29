import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

type CardOperator = {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  debitRate: string;
  creditRate: string;
  installmentRate: string;
  settlementDays: number;
  active: boolean;
};
type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  type: string;
  fiscalCode: string;
  cardOperatorId: string | null;
  maxInstallments: number;
  createsReceivable: boolean;
  active: boolean;
};
type Configuration = { cardOperators: CardOperator[]; paymentMethods: PaymentMethod[] };

export function PaymentConfigurationPanel({
  mode,
  canManage,
}: {
  mode: 'operators' | 'methods';
  canManage: boolean;
}) {
  const [data, setData] = useState<Configuration>({ cardOperators: [], paymentMethods: [] });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setData(await apiRequest<Configuration>('/cash/configuration'));
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => void load(), []);

  async function createOperator(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest('/cash/card-operators', {
        method: 'POST',
        body: JSON.stringify({
          code: form.get('code'),
          name: form.get('name'),
          taxId: form.get('taxId') || null,
          debitRate: form.get('debitRate'),
          creditRate: form.get('creditRate'),
          installmentRate: form.get('installmentRate'),
          settlementDays: form.get('settlementDays'),
          active: true,
        }),
      });
      setCreating(false);
      await load();
    } catch (reason) {
      setError(message(reason));
    }
  }

  async function createMethod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawType = form.get('type');
    const type = typeof rawType === 'string' ? rawType : 'other';
    try {
      await apiRequest('/cash/payment-methods', {
        method: 'POST',
        body: JSON.stringify({
          code: form.get('code'),
          name: form.get('name'),
          type,
          fiscalCode: form.get('fiscalCode'),
          cardOperatorId: form.get('cardOperatorId') || null,
          maxInstallments: type === 'credit_card' ? form.get('maxInstallments') : 1,
          createsReceivable: form.get('createsReceivable') === 'on',
          active: true,
        }),
      });
      setCreating(false);
      await load();
    } catch (reason) {
      setError(message(reason));
    }
  }

  async function toggle(
    kind: 'card-operators' | 'payment-methods',
    item: CardOperator | PaymentMethod,
  ) {
    try {
      await apiRequest(`/cash/${kind}/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      });
      await load();
    } catch (reason) {
      setError(message(reason));
    }
  }

  const operatorsMode = mode === 'operators';
  return (
    <section>
      <PageHeader
        title={operatorsMode ? 'Operadoras de cartões' : 'Finalizadores de pagamento'}
        description={
          operatorsMode
            ? 'Cadastre adquirentes, taxas e prazos para visualizar o valor líquido das vendas.'
            : 'Defina as formas de pagamento liberadas no PDV e seu comportamento financeiro e fiscal.'
        }
        action={canManage ? () => setCreating(true) : undefined}
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {creating && operatorsMode && (
        <form
          className="inline-form payment-config-form"
          onSubmit={(event) => void createOperator(event)}
        >
          <label>
            Código
            <input name="code" required />
          </label>
          <label>
            Operadora
            <input name="name" required />
          </label>
          <label>
            CNPJ
            <input name="taxId" inputMode="numeric" maxLength={18} />
          </label>
          <label>
            Taxa débito (%)
            <input
              name="debitRate"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Taxa crédito (%)
            <input
              name="creditRate"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Adicional por parcela (%)
            <input
              name="installmentRate"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Prazo (dias)
            <input
              name="settlementDays"
              type="number"
              min="0"
              max="365"
              defaultValue="1"
              required
            />
          </label>
          <div className="form-actions">
            <button type="button" className="quiet" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button className="primary">Salvar operadora</button>
          </div>
        </form>
      )}
      {creating && !operatorsMode && (
        <form
          className="inline-form payment-config-form"
          onSubmit={(event) => void createMethod(event)}
        >
          <label>
            Código
            <input name="code" required />
          </label>
          <label>
            Nome no PDV
            <input name="name" required />
          </label>
          <label>
            Tipo
            <select name="type" required>
              <option value="cash">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="debit_card">Cartão de débito</option>
              <option value="credit_card">Cartão de crédito</option>
              <option value="credit_account">Crediário</option>
              <option value="voucher">Voucher</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label>
            Código fiscal
            <input name="fiscalCode" defaultValue="99" required />
          </label>
          <label>
            Operadora
            <select name="cardOperatorId">
              <option value="">Sem operadora</option>
              {data.cardOperators
                .filter(({ active }) => active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Máximo de parcelas
            <input
              name="maxInstallments"
              type="number"
              min="1"
              max="48"
              defaultValue="1"
              required
            />
          </label>
          <label className="option">
            <input name="createsReceivable" type="checkbox" />
            Gerar conta a receber
          </label>
          <div className="form-actions">
            <button type="button" className="quiet" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button className="primary">Salvar finalizador</button>
          </div>
        </form>
      )}
      <div className="table-card">
        {operatorsMode ? (
          <table>
            <thead>
              <tr>
                <th>Operadora</th>
                <th>Débito</th>
                <th>Crédito</th>
                <th>Parcelamento</th>
                <th>Liquidação</th>
                <th>Exemplo líquido</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.cardOperators.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.code}</small>
                  </td>
                  <td>{percent(item.debitRate)}</td>
                  <td>{percent(item.creditRate)}</td>
                  <td>+ {percent(item.installmentRate)} / parcela</td>
                  <td>D+{item.settlementDays}</td>
                  <td>
                    <strong>{money(100 - Number(item.creditRate))}</strong>
                    <small>sobre R$ 100 no crédito 1x</small>
                  </td>
                  <td>
                    {canManage && (
                      <button className="link" onClick={() => void toggle('card-operators', item)}>
                        {item.active ? 'Inativar' : 'Ativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Finalizador</th>
                <th>Tipo</th>
                <th>Fiscal</th>
                <th>Operadora</th>
                <th>Parcelas</th>
                <th>Financeiro</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.paymentMethods.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.code}</small>
                  </td>
                  <td>{typeName(item.type)}</td>
                  <td>{item.fiscalCode}</td>
                  <td>
                    {data.cardOperators.find(({ id }) => id === item.cardOperatorId)?.name ?? '—'}
                  </td>
                  <td>até {item.maxInstallments}x</td>
                  <td>{item.createsReceivable ? 'Gera recebível' : 'Liquidação direta'}</td>
                  <td>
                    {canManage && (
                      <button className="link" onClick={() => void toggle('payment-methods', item)}>
                        {item.active ? 'Inativar' : 'Ativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(operatorsMode ? data.cardOperators : data.paymentMethods).length === 0 && (
          <div className="empty-row">Nenhum cadastro encontrado.</div>
        )}
      </div>
    </section>
  );
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Não foi possível salvar a configuração';
}
function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function percent(value: string) {
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;
}
function typeName(value: string) {
  return (
    (
      {
        cash: 'Dinheiro',
        pix: 'PIX',
        debit_card: 'Débito',
        credit_card: 'Crédito',
        credit_account: 'Crediário',
        voucher: 'Voucher',
        other: 'Outro',
      } as Record<string, string>
    )[value] ?? value
  );
}
