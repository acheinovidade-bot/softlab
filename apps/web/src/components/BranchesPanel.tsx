import { useEffect, useState } from 'react';
import type { BranchSummary, FiscalPosTerminalSummary } from '@erp/contracts';
import { apiRequest } from '../api';

export function BranchesPanel({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<BranchSummary[]>([]);
  const [terminals, setTerminals] = useState<FiscalPosTerminalSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [terminalBranchId, setTerminalBranchId] = useState('');
  const [error, setError] = useState('');
  async function load(): Promise<void> {
    try {
      const [branches, fiscalTerminals] = await Promise.all([
        apiRequest<BranchSummary[]>('/admin/branches'),
        apiRequest<FiscalPosTerminalSummary[]>('/admin/fiscal-pos-terminals'),
      ]);
      setItems(branches);
      setTerminals(fiscalTerminals);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function create(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const branch = await apiRequest<BranchSummary>('/admin/branches', {
        method: 'POST',
        body: JSON.stringify({
          code: data.get('code'),
          legalName: data.get('legalName'),
          tradeName: data.get('tradeName') || undefined,
          taxId: data.get('taxId'),
        }),
      });
      await createTerminal(branch.id, data);
      setCreating(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao salvar');
    }
  }
  async function createTerminal(branchId: string, data: FormData) {
    await apiRequest('/admin/fiscal-pos-terminals', {
      method: 'POST',
      body: JSON.stringify({
        branchId,
        posNumber: data.get('posNumber'),
        description: data.get('description'),
        cashRegisterCode: data.get('cashRegisterCode'),
        cscToken: data.get('cscToken'),
        cscCode: data.get('cscCode'),
        onlineSeries: data.get('onlineSeries'),
        offlineSeries: data.get('offlineSeries'),
        nfeSeries: data.get('nfeSeries'),
      }),
    });
  }
  async function addTerminal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createTerminal(terminalBranchId, new FormData(event.currentTarget));
      setTerminalBranchId('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao salvar o PDV fiscal');
    }
  }
  return (
    <section>
      <PageHeader
        title="Filiais"
        description="Unidades operacionais da empresa atual."
        action={canManage ? () => setCreating(true) : undefined}
      />
      {error && <div className="error">{error}</div>}
      {creating && (
        <form className="inline-form" onSubmit={(event) => void create(event)}>
          <label>
            Código
            <input name="code" required />
          </label>
          <label>
            Razão social
            <input name="legalName" required />
          </label>
          <label>
            Nome fantasia
            <input name="tradeName" />
          </label>
          <label>
            CNPJ
            <input name="taxId" inputMode="numeric" pattern="\d{14}" required />
          </label>
          <FiscalTerminalFields />
          <div className="form-actions">
            <button type="button" className="quiet" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button className="primary">Salvar filial</button>
          </div>
        </form>
      )}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Filial</th>
              <th>CNPJ</th>
              <th>Status</th>
              <th>PDVs fiscais</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.code}</strong>
                </td>
                <td>{item.tradeName || item.legalName}</td>
                <td>{item.taxId}</td>
                <td>
                  <span className={`badge ${item.status}`}>
                    {item.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td>{terminals.filter(({ branchId }) => branchId === item.id).length}</td>
                <td>
                  {canManage && (
                    <button type="button" className="link" onClick={() => setTerminalBranchId(item.id)}>
                      Configurar PDV fiscal
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty-row">Nenhuma filial encontrada.</div>}
      </div>
      {terminalBranchId && (
        <form className="inline-form" onSubmit={(event) => void addTerminal(event)}>
          <h2>Fiscal · {items.find(({ id }) => id === terminalBranchId)?.tradeName || items.find(({ id }) => id === terminalBranchId)?.legalName}</h2>
          <FiscalTerminalFields />
          <div className="form-actions">
            <button type="button" className="quiet" onClick={() => setTerminalBranchId('')}>Cancelar</button>
            <button className="primary">Salvar PDV fiscal</button>
          </div>
        </form>
      )}
      <div className="table-card">
        <table>
          <thead><tr><th>Filial</th><th>PDV</th><th>Caixa / computador</th><th>Série NFC-e online</th><th>Série NFC-e offline</th><th>Série NF-e</th><th>Vínculo local</th></tr></thead>
          <tbody>
            {terminals.map((terminal) => (
              <tr key={terminal.id}>
                <td>{items.find(({ id }) => id === terminal.branchId)?.code}</td>
                <td><strong>PDV {terminal.posNumber}</strong></td>
                <td>{terminal.cashRegisterCode} · {terminal.description}</td>
                <td>{terminal.onlineSeries}</td><td>{terminal.offlineSeries}</td><td>{terminal.nfeSeries}</td>
                <td><button type="button" className="link" onClick={() => {
                  localStorage.setItem('softlab:pos-fiscal-terminal-id', terminal.id);
                  setError(`Este computador foi vinculado ao PDV ${terminal.posNumber}.`);
                }}>Vincular este computador</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {terminals.length === 0 && <div className="empty-row">Nenhum PDV fiscal configurado.</div>}
      </div>
    </section>
  );
}

function FiscalTerminalFields() {
  return (
    <fieldset className="full">
      <legend>Fiscal e vínculo do PDV</legend>
      <div className="form-grid">
        <label>Número do PDV<input name="posNumber" type="number" min="1" required /></label>
        <label>Descrição do computador/PDV<input name="description" placeholder="Caixa da recepção" required /></label>
        <label>Código do caixa<input name="cashRegisterCode" placeholder="CAIXA-01" required /></label>
        <label>Token CSC<input name="cscToken" autoComplete="off" required /></label>
        <label>Chave CSC<input name="cscCode" type="password" autoComplete="new-password" required /></label>
        <label>Série PDV online<input name="onlineSeries" inputMode="numeric" pattern="\d+" required /></label>
        <label>Série PDV offline<input name="offlineSeries" inputMode="numeric" pattern="\d+" required /></label>
        <label>Série NF-e<input name="nfeSeries" inputMode="numeric" pattern="\d+" defaultValue="1" required /></label>
      </div>
    </fieldset>
  );
}

export function PageHeader({
  title,
  description,
  action,
  actionLabel = '+ Novo',
}: {
  title: string;
  description: string;
  action?: (() => void) | undefined;
  actionLabel?: string;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <button className="primary" onClick={action}>
          {actionLabel}
        </button>
      )}
    </header>
  );
}
