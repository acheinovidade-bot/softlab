import { useEffect, useRef, useState } from 'react';
import type { BranchSummary, CnpjSuggestion, FiscalPosTerminalSummary } from '@erp/contracts';
import { apiRequest } from '../api';

export function BranchesPanel({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<BranchSummary[]>([]);
  const [terminals, setTerminals] = useState<FiscalPosTerminalSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [terminalBranchId, setTerminalBranchId] = useState('');
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const branchFormRef = useRef<HTMLFormElement>(null);
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
          stateRegistration: data.get('stateRegistration') || null,
          municipalRegistration: data.get('municipalRegistration') || null,
          taxRegime: data.get('taxRegime') || null,
          cnae: data.get('cnae') || null, phone: data.get('phone') || null,
          email: data.get('email') || null, postalCode: data.get('postalCode') || null,
          street: data.get('street') || null, addressNumber: data.get('addressNumber') || null,
          complement: data.get('complement') || null, district: data.get('district') || null,
          city: data.get('city') || null, state: data.get('state') || null,
        }),
      });
      await createTerminal(branch.id, data);
      setCreating(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao salvar');
    }
  }
  async function lookupCnpj() {
    const form = branchFormRef.current;
    if (!form) return;
    const rawCnpj = new FormData(form).get('taxId');
    const cnpj = (typeof rawCnpj === 'string' ? rawCnpj : '').replace(/\D/g, '');
    if (cnpj.length !== 14) return setError('Informe os 14 dígitos do CNPJ antes da consulta.');
    setLookingUp(true); setError('Consultando cadastro público da Receita…');
    try {
      const result = await apiRequest<CnpjSuggestion>(`/admin/company-profile/cnpj/${cnpj}`);
      if (!result.found || !result.fields) return setError('CNPJ não localizado. Continue o preenchimento manualmente.');
      const fields = result.fields;
      setFormValue(form, 'legalName', fields.legalName); setFormValue(form, 'tradeName', fields.tradeName);
      setFormValue(form, 'stateRegistration', fields.stateRegistration); setFormValue(form, 'cnae', fields.cnae);
      setFormValue(form, 'phone', fields.phone); setFormValue(form, 'email', fields.email);
      setFormValue(form, 'postalCode', fields.address?.postalCode); setFormValue(form, 'street', fields.address?.street);
      setFormValue(form, 'addressNumber', fields.address?.number); setFormValue(form, 'complement', fields.address?.complement);
      setFormValue(form, 'district', fields.address?.district); setFormValue(form, 'city', fields.address?.city);
      setFormValue(form, 'state', fields.address?.state);
      setError('Dados localizados e preenchidos. Confira a classificação fiscal e salve a filial.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao consultar o CNPJ'); }
    finally { setLookingUp(false); }
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
        <form ref={branchFormRef} className="inline-form" onSubmit={(event) => void create(event)}>
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
            <span className="cnpj-lookup-field"><input name="taxId" aria-label="CNPJ" inputMode="numeric" pattern="\d{14}" maxLength={14} required onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void lookupCnpj(); } }} /><button type="button" aria-label="Consultar CNPJ na Receita Federal" title="Consultar CNPJ" disabled={lookingUp} onClick={() => void lookupCnpj()}>🔍</button></span>
          </label>
          <fieldset className="full"><legend>Cadastro fiscal e contato</legend><div className="form-grid">
            <label>Inscrição estadual<input name="stateRegistration" /></label>
            <label>Inscrição municipal<input name="municipalRegistration" /></label>
            <label>CNAE / classificação fiscal<input name="cnae" inputMode="numeric" /></label>
            <label>Regime tributário<select name="taxRegime"><option value="">Selecione</option><option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option><option>MEI</option></select></label>
            <label>E-mail fiscal<input name="email" type="email" /></label>
            <label>Telefone<input name="phone" /></label>
          </div></fieldset>
          <fieldset className="full"><legend>Endereço da filial</legend><div className="form-grid">
            <label>CEP<input name="postalCode" inputMode="numeric" maxLength={8} /></label>
            <label>Logradouro<input name="street" /></label><label>Número<input name="addressNumber" /></label>
            <label>Complemento<input name="complement" /></label><label>Bairro<input name="district" /></label>
            <label>Cidade<input name="city" /></label><label>UF<input name="state" maxLength={2} /></label>
          </div></fieldset>
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

function setFormValue(form: HTMLFormElement, name: string, value: string | null | undefined) {
  if (!value) return;
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value;
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
