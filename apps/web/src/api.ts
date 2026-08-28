import type { ApiErrorResponse, AuthTokens } from '@erp/contracts';
import { demoResponse } from './demo';

const apiUrl = String(import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1');
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo'))
    return demoResponse(path) as T;
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers, credentials: 'include' });
  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ message: 'Falha na comunicação' }))) as Partial<ApiErrorResponse>;
    throw new Error(error.message ?? 'Falha na comunicação');
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function refreshSession(): Promise<AuthTokens | null> {
  try {
    const tokens = await apiRequest<AuthTokens>('/auth/refresh', { method: 'POST', body: '{}' });
    setAccessToken(tokens.accessToken);
    return tokens;
  } catch {
    setAccessToken(null);
    return null;
  }
}
