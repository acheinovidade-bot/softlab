import { useEffect, useState } from 'react';
import type { AuthTokens, CurrentUser } from '@erp/contracts';
import { apiRequest, refreshSession, setAccessToken } from './api';
import { LoginPage } from './components/LoginPage';
import { AdminShell } from './components/AdminShell';
import { PublicQuotationPage } from './components/PublicQuotationPage';
import { demoUser } from './demo';
import { PublicDigitalMenu } from './components/PublicDigitalMenu';

type SessionState =
  { kind: 'loading' } | { kind: 'guest' } | { kind: 'authenticated'; user: CurrentUser };
const offlineUserKey = 'erp-hibrido:offline-user';

export function App() {
  const demo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('demo') : null;
  const publicQuotationToken =
    window.location.pathname.match(/^\/quotation\/([A-Za-z0-9_-]{43})$/)?.[1] ?? null;
  const publicMenuToken = window.location.pathname.match(/^\/menu\/([0-9a-f-]{36})$/i)?.[1] ?? null;
  const [session, setSession] = useState<SessionState>({ kind: 'loading' });
  useEffect(() => {
    if (publicQuotationToken || publicMenuToken) return;
    void refreshSession().then(async (tokens) => {
      if (!tokens) {
        if (!navigator.onLine) {
          const cached = localStorage.getItem(offlineUserKey);
          if (cached) {
            try {
              return setSession({ kind: 'authenticated', user: JSON.parse(cached) as CurrentUser });
            } catch {
              localStorage.removeItem(offlineUserKey);
            }
          }
        }
        return setSession({ kind: 'guest' });
      }
      try {
        const user = await apiRequest<CurrentUser>('/auth/me');
        localStorage.setItem(offlineUserKey, JSON.stringify(user));
        setSession({ kind: 'authenticated', user });
      } catch {
        setAccessToken(null);
        setSession({ kind: 'guest' });
      }
    });
  }, [publicQuotationToken, publicMenuToken]);
  async function completeLogin(tokens: AuthTokens): Promise<void> {
    setAccessToken(tokens.accessToken);
    const user = await apiRequest<CurrentUser>('/auth/me');
    localStorage.setItem(offlineUserKey, JSON.stringify(user));
    setSession({ kind: 'authenticated', user });
  }
  async function logout(): Promise<void> {
    await apiRequest<void>('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
    setAccessToken(null);
    localStorage.removeItem(offlineUserKey);
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
  if (publicMenuToken) return <PublicDigitalMenu token={publicMenuToken} />;
  if (session.kind === 'loading')
    return (
      <main className="center">
        <div className="loader" aria-label="Carregando" />
      </main>
    );
  if (session.kind === 'guest') return <LoginPage onAuthenticated={completeLogin} />;
  if (window.location.pathname === '/forca-vendas')
    return <AdminShell user={session.user} onLogout={logout} initialSection="sales-force" />;
  return <AdminShell user={session.user} onLogout={logout} />;
}
