import { useState } from 'react';
import type { AuthTokens } from '@erp/contracts';
import { apiRequest } from '../api';

export function LoginPage({
  onAuthenticated,
}: {
  onAuthenticated: (tokens: AuthTokens) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const values = new FormData(event.currentTarget);
    try {
      const tokens = await apiRequest<AuthTokens>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: values.get('email'),
          password: values.get('password'),
          companyId: values.get('companyId'),
          branchId: values.get('branchId'),
        }),
      });
      await onAuthenticated(tokens);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar');
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="pos-login-layout">
      <header className="pos-login-header">
        <div className="pos-brand">
          <span className="pos-brand-mark">EH</span>
          <span>
            <strong>ERP Híbrido</strong>
            <small>Tecnologia</small>
          </span>
        </div>
        <strong>Frente de caixa</strong>
        <span className="pos-help-button">?</span>
      </header>
      <div className="pos-login-background" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
      <section className="pos-login-card" aria-labelledby="login-title">
        <div className="pos-login-logo">
          <strong>EH</strong>
          <span>
            sistema
            <br />
            de gestão
          </span>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <h1 id="login-title">ACESSO AO SISTEMA</h1>
          <label>
            USUÁRIO OU E-MAIL
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label>
            SENHA
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <div className="pos-login-context">
            <label>
              EMPRESA
              <input name="companyId" required placeholder="ID da empresa" />
            </label>
            <label>
              FILIAL
              <input name="branchId" required placeholder="ID da filial" />
            </label>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="pos-login-submit" disabled={submitting}>
            {submitting ? 'ENTRANDO…' : 'ENTRAR'}
          </button>
          <label className="pos-login-save">
            <input type="checkbox" defaultChecked /> Salvar o e-mail como padrão
          </label>
          <small>[F3] Consultar produtos</small>
        </form>
      </section>
    </main>
  );
}
