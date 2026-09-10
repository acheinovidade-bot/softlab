import { useEffect, useState } from 'react';
import type { CnpjSuggestion, CompanyProfile, FiscalPosTerminalSummary } from '@erp/contracts';
import { apiRequest } from '../api';

const empty: CompanyProfile = {
  id: '', taxId: '', legalName: '', tradeName: '', timezone: 'America/Fortaleza',
  stateRegistration: '', municipalRegistration: '', taxRegime: '', cnae: '', phone: '', email: '',
  postalCode: '', street: '', addressNumber: '', complement: '', district: '', city: '', state: '',
};

export function CompanyProfilePanel({ canManage }: { canManage: boolean }) {
  const [profile, setProfile] = useState<CompanyProfile>(empty);
  const [terminals, setTerminals] = useState<FiscalPosTerminalSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      const [company, fiscalTerminals] = await Promise.all([
        apiRequest<CompanyProfile>('/admin/company-profile'),
        apiRequest<FiscalPosTerminalSummary[]>('/admin/fiscal-pos-terminals'),
      ]);
      setProfile(company); setTerminals(fiscalTerminals);
    } catch (reason) { setNotice(message(reason)); }
  }
  useEffect(() => { void load(); }, []);
  function update(field: keyof CompanyProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }
  async function lookupCnpj() {
    const cnpj = profile.taxId.replace(/\D/g, '');
    if (cnpj.length !== 14) return setNotice('Informe os 14 dígitos do CNPJ.');
    setBusy(true); setNotice('Consultando dados cadastrais da Receita…');
    try {
      const suggestion = await apiRequest<CnpjSuggestion>(`/admin/company-profile/cnpj/${cnpj}`);
      if (!suggestion.found || !suggestion.fields) return setNotice('CNPJ não localizado. Preencha os dados manualmente.');
      const fields = suggestion.fields;
      setProfile((current) => ({ ...current, taxId: cnpj,
        legalName: fields.legalName ?? current.legalName, tradeName: fields.tradeName ?? current.tradeName,
        phone: fields.phone ?? current.phone, email: fields.email ?? current.email,
        cnae: fields.cnae ?? current.cnae, stateRegistration: fields.stateRegistration ?? current.stateRegistration,
        postalCode: fields.address?.postalCode ?? current.postalCode, street: fields.address?.street ?? current.street,
        addressNumber: fields.address?.number ?? current.addressNumber, complement: fields.address?.complement ?? current.complement,
        district: fields.address?.district ?? current.district, city: fields.address?.city ?? current.city,
        state: fields.address?.state ?? current.state,
      }));
      setNotice('Dados encontrados e preenchidos. Confira antes de salvar.');
    } catch (reason) { setNotice(message(reason)); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const saved = await apiRequest<CompanyProfile>('/admin/company-profile', { method: 'PUT', body: JSON.stringify(profile) });
      setProfile(saved); setNotice('Cadastro da empresa salvo com sucesso.');
    } catch (reason) { setNotice(message(reason)); }
    finally { setBusy(false); }
  }
  return <section>
    <header className="page-header"><div><span className="eyebrow">CONFIGURAÇÕES</span><h1>Cadastro da empresa</h1><p>Dados legais, fiscais, endereço e sequências emitidas por PDV.</p></div></header>
    {notice && <div className={notice.includes('sucesso') || notice.includes('encontrados') ? 'success' : 'info'} role="status">{notice}</div>}
    <form className="inline-form company-profile-form" onSubmit={(event) => void save(event)}>
      <fieldset className="full"><legend>Identificação</legend><div className="form-grid">
        <label>CNPJ <small>Digite e pressione Enter</small><input value={profile.taxId} inputMode="numeric" maxLength={14} required disabled={!canManage} onChange={(e) => update('taxId', e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lookupCnpj(); } }} /></label>
        <label>Razão social<input value={profile.legalName} required disabled={!canManage} onChange={(e) => update('legalName', e.target.value)} /></label>
        <label>Nome fantasia<input value={profile.tradeName ?? ''} disabled={!canManage} onChange={(e) => update('tradeName', e.target.value)} /></label>
        <label>Inscrição estadual<input value={profile.stateRegistration ?? ''} disabled={!canManage} onChange={(e) => update('stateRegistration', e.target.value)} /></label>
        <label>Inscrição municipal<input value={profile.municipalRegistration ?? ''} disabled={!canManage} onChange={(e) => update('municipalRegistration', e.target.value)} /></label>
        <label>CNAE principal<input value={profile.cnae ?? ''} disabled={!canManage} onChange={(e) => update('cnae', e.target.value.replace(/\D/g, ''))} /></label>
        <label>Regime tributário<select value={profile.taxRegime ?? ''} disabled={!canManage} onChange={(e) => update('taxRegime', e.target.value)}><option value="">Selecione</option><option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option><option>MEI</option></select></label>
        <label>Telefone<input value={profile.phone ?? ''} disabled={!canManage} onChange={(e) => update('phone', e.target.value)} /></label>
        <label>E-mail<input type="email" value={profile.email ?? ''} disabled={!canManage} onChange={(e) => update('email', e.target.value)} /></label>
      </div></fieldset>
      <fieldset className="full"><legend>Endereço</legend><div className="form-grid">
        <label>CEP<input value={profile.postalCode ?? ''} maxLength={8} disabled={!canManage} onChange={(e) => update('postalCode', e.target.value.replace(/\D/g, ''))} /></label>
        <label>Logradouro<input value={profile.street ?? ''} disabled={!canManage} onChange={(e) => update('street', e.target.value)} /></label>
        <label>Número<input value={profile.addressNumber ?? ''} disabled={!canManage} onChange={(e) => update('addressNumber', e.target.value)} /></label>
        <label>Complemento<input value={profile.complement ?? ''} disabled={!canManage} onChange={(e) => update('complement', e.target.value)} /></label>
        <label>Bairro<input value={profile.district ?? ''} disabled={!canManage} onChange={(e) => update('district', e.target.value)} /></label>
        <label>Cidade<input value={profile.city ?? ''} disabled={!canManage} onChange={(e) => update('city', e.target.value)} /></label>
        <label>UF<input value={profile.state ?? ''} maxLength={2} disabled={!canManage} onChange={(e) => update('state', e.target.value.toUpperCase())} /></label>
      </div></fieldset>
      {canManage && <div className="form-actions"><button type="button" className="quiet" disabled={busy} onClick={() => void lookupCnpj()}>Consultar CNPJ</button><button className="primary" disabled={busy}>Salvar cadastro</button></div>}
    </form>
    <header className="page-header compact"><div><h2>Numeração fiscal por PDV</h2><p>Últimos números efetivamente processados; pedidos offline avançam ao sincronizar.</p></div></header>
    <div className="table-card"><table><thead><tr><th>PDV</th><th>Séries</th><th>Último pedido</th><th>Última NFC-e online</th><th>Última NFC-e offline</th><th>Última NF-e</th></tr></thead><tbody>{terminals.map((terminal) => <tr key={terminal.id}><td><strong>PDV {terminal.posNumber}</strong><small className="table-subtitle">{terminal.description}</small></td><td>NFC-e {terminal.onlineSeries}/{terminal.offlineSeries} · NF-e {terminal.nfeSeries}</td><td>{terminal.lastOrderNumber}</td><td>{terminal.lastNfceNumber}</td><td>{terminal.lastNfceOfflineNumber}</td><td>{terminal.lastNfeNumber}</td></tr>)}</tbody></table>{!terminals.length && <div className="empty-row">Configure os PDVs fiscais no cadastro de filiais.</div>}</div>
  </section>;
}

function message(reason: unknown) { return reason instanceof Error ? reason.message : 'Falha ao processar o cadastro'; }
