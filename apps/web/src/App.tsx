import { useEffect, useState } from 'react';
import type { AuthTokens, CurrentUser } from '@erp/contracts';
import { apiRequest, refreshSession, setAccessToken } from './api';
import { LoginPage } from './components/LoginPage';
import { AdminShell } from './components/AdminShell';
import { PublicQuotationPage } from './components/PublicQuotationPage';
import { demoUser } from './demo';

type SessionState =
  { kind: 'loading' } | { kind: 'guest' } | { kind: 'authenticated'; user: CurrentUser };

export function App() {
  const demo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('demo') : null;
  const publicQuotationToken =
    window.location.pathname.match(/^\/quotation\/([A-Za-z0-9_-]{43})$/)?.[1] ?? null;
  const [session, setSession] = useState<SessionState>({ kind: 'loading' });
  useEffect(() => {
    if (publicQuotationToken) return;
    void refreshSession().then(async (tokens) => {
      if (!tokens) return setSession({ kind: 'guest' });
      try {
        setSession({ kind: 'authenticated', user: await apiRequest<CurrentUser>('/auth/me') });
      } catch {
        setAccessToken(null);
        setSession({ kind: 'guest' });
      }
    });
  }, [publicQuotationToken]);
  async function completeLogin(tokens: AuthTokens): Promise<void> {
    setAccessToken(tokens.accessToken);
    setSession({ kind: 'authenticated', user: await apiRequest<CurrentUser>('/auth/me') });
  }
  async function logout(): Promise<void> {
    await apiRequest<void>('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
    setAccessToken(null);
    setSession({ kind: 'guest' });
  }
  if (demo)
    return (
      <AdminShell
        user={demoUser}
        onLogout={() => Promise.resolve()}
        initialSection={demo === 'pos' ? 'pos' : demo === 'food' ? 'food' : 'products'}
      />
    );
  if (publicQuotationToken) return <PublicQuotationPage token={publicQuotationToken} />;
  if (session.kind === 'loading')
    return (
      <main className="center">
        <div className="loader" aria-label="Carregando" />
      </main>
    );
  if (session.kind === 'guest') return <LoginPage onAuthenticated={completeLogin} />;
  return <AdminShell user={session.user} onLogout={logout} />;
}
