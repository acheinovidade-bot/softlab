import type { ApiErrorResponse, AuthTokens } from '@erp/contracts';
import { demoResponse } from './demo';

const apiUrl = String(import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1');
let accessToken: string | null = null;
const clientLogKey = 'softlab:client-event-log';

export interface ClientEventLog {
  occurredAt: string;
  level: 'info' | 'warning' | 'error';
  eventType: string;
  message: string;
  context?: Record<string, unknown>;
}

export function readClientEventLog(): ClientEventLog[] {
  if (typeof localStorage === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(clientLogKey) ?? '[]') as ClientEventLog[]; }
  catch { return []; }
}

function recordClientEvent(event: Omit<ClientEventLog, 'occurredAt'>): void {
  if (typeof localStorage === 'undefined') return;
  const events = [{ ...event, occurredAt: new Date().toISOString() }, ...readClientEventLog()].slice(0, 200);
  localStorage.setItem(clientLogKey, JSON.stringify(events));
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')) {
    try {
      const result = demoResponse(path, method, options.body) as T;
      if (method !== 'GET') recordClientEvent({ level: 'info', eventType: 'demo.request.completed', message: `${method} ${path}`, context: { path, method } });
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Falha no modo demonstração';
      recordClientEvent({ level: 'error', eventType: 'demo.request.failed', message, context: { path, method } });
      throw reason;
    }
  }
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers, credentials: 'include' });
  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ message: 'Falha na comunicação' }))) as Partial<ApiErrorResponse>;
    const message = error.message ?? 'Falha na comunicação';
    recordClientEvent({ level: 'error', eventType: 'api.request.failed', message, context: { path, method, status: response.status, correlationId: error.correlationId } });
    throw new Error(message);
  }
  if (method !== 'GET') recordClientEvent({ level: 'info', eventType: 'api.request.completed', message: `${method} ${path}`, context: { path, method, status: response.status } });
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
