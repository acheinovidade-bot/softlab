import { useState } from 'react';
import type { AuthTokens } from '@erp/contracts';
import { apiRequest } from '../api';

export function LoginPage({ onAuthenticated }: { onAuthenticated: (tokens: AuthTokens) => Promise<void> }) {
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSubmitting(true); setError(''); const values = new FormData(event.currentTarget);
    try { const tokens = await apiRequest<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify({ email: values.get('email'), password: values.get('password'), companyId: values.get('companyId'), branchId: values.get('branchId') }) }); await onAuthenticated(tokens); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível entrar'); } finally { setSubmitting(false); }
  }
  return <main className="login-layout"><section className="login-brand"><span className="eyebrow">ERP HÍBRIDO</span><h1>Gestão clara.<br />Operação rápida.</h1><p>Uma base única para acompanhar filiais, equipes e permissões com segurança.</p></section><section className="login-panel" aria-labelledby="login-title"><form className="form-card" onSubmit={(event) => void submit(event)}><div><span className="eyebrow">ACESSO SEGURO</span><h2 id="login-title">Entrar no ERP</h2><p>Use suas credenciais e o contexto fornecido pelo administrador.</p></div><label>E-mail<input name="email" type="email" autoComplete="username" required /></label><label>Senha<input name="password" type="password" autoComplete="current-password" required /></label><label>Empresa<input name="companyId" required placeholder="ID da empresa" /></label><label>Filial<input name="branchId" required placeholder="ID da filial" /></label>{error && <div className="error" role="alert">{error}</div>}<button className="primary" disabled={submitting}>{submitting ? 'Entrando…' : 'Entrar'}</button></form></section></main>;
}
