import { useEffect, useState } from 'react';
import type { PageResult, WhatsappIntegrationConfig, WhatsappMessageSummary } from '@erp/contracts';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

const empty = {
  status: 'inactive' as const,
  provider: 'evolution' as const,
  baseUrl: '',
  instanceName: '',
  sendTextPath: '/message/sendText/{instance}',
  apiKeyEnvKey: 'WHATSAPP_GATEWAY_API_KEY_TENANT',
  webhookSecretEnvKey: 'WHATSAPP_GATEWAY_WEBHOOK_SECRET_TENANT',
};

export function WhatsappIntegrationPanel({
  canManage,
  canSend,
}: {
  canManage: boolean;
  canSend: boolean;
}) {
  const [config, setConfig] = useState<WhatsappIntegrationConfig | null>(null);
  const [messages, setMessages] = useState<PageResult<WhatsappMessageSummary>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 100,
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      const [nextConfig, nextMessages] = await Promise.all([
        apiRequest<WhatsappIntegrationConfig | null>('/integrations/whatsapp'),
        apiRequest<PageResult<WhatsappMessageSummary>>('/integrations/whatsapp/messages'),
      ]);
      setConfig(nextConfig);
      setMessages(nextMessages);
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const values = new FormData(event.currentTarget);
    try {
      const saved = await apiRequest<WhatsappIntegrationConfig>('/integrations/whatsapp', {
        method: 'PUT',
        body: JSON.stringify({
          status: values.get('status'),
          provider: 'evolution',
          baseUrl: values.get('baseUrl'),
          instanceName: values.get('instanceName'),
          sendTextPath: values.get('sendTextPath'),
          apiKeyEnvKey: values.get('apiKeyEnvKey'),
          webhookSecretEnvKey: values.get('webhookSecretEnvKey'),
        }),
      });
      setConfig(saved);
      setNotice('Configuração salva. As credenciais continuam fora do banco de dados.');
    } catch (reason) {
      setError(message(reason));
    }
  }
  async function retry(id: string) {
    try {
      await apiRequest(`/integrations/whatsapp/messages/${id}/retry`, { method: 'POST' });
      await load();
    } catch (reason) {
      setError(message(reason));
    }
  }
  const value =
    config ?? ({ id: '', webhookPath: '', ...empty } satisfies WhatsappIntegrationConfig);
  return (
    <section>
      <PageHeader
        title="Integração WhatsApp"
        description="Gateway não oficial isolado por adaptador Evolution, com credenciais referenciadas pelo ambiente."
      />
      {error && <div className="error">{error}</div>}
      {notice && <p className="success-message">{notice}</p>}
      <aside className="integration-warning">
        <strong>Atenção operacional</strong>
        <span>
          Esta conexão usa automação não oficial. O provedor pode mudar e a conta pode sofrer
          restrições; mantenha um número dedicado e o compartilhamento manual disponível.
        </span>
      </aside>
      <form
        key={config?.id ?? 'new'}
        className="inline-form integration-form"
        onSubmit={(event) => void save(event)}
      >
        <label>
          Status
          <select name="status" defaultValue={value.status} disabled={!canManage}>
            <option value="inactive">Inativa</option>
            <option value="active">Ativa</option>
          </select>
        </label>
        <label>
          URL do gateway
          <input
            name="baseUrl"
            type="url"
            required
            defaultValue={value.baseUrl}
            placeholder="https://evolution.exemplo.com"
            disabled={!canManage}
          />
        </label>
        <label>
          Instância
          <input
            name="instanceName"
            required
            defaultValue={value.instanceName}
            disabled={!canManage}
          />
        </label>
        <label>
          Caminho de envio
          <input
            name="sendTextPath"
            required
            defaultValue={value.sendTextPath}
            disabled={!canManage}
          />
        </label>
        <label>
          Variável da API key
          <input
            name="apiKeyEnvKey"
            required
            defaultValue={value.apiKeyEnvKey}
            disabled={!canManage}
          />
        </label>
        <label>
          Variável do segredo do webhook
          <input
            name="webhookSecretEnvKey"
            required
            defaultValue={value.webhookSecretEnvKey}
            disabled={!canManage}
          />
        </label>
        {config && (
          <label className="wide-field">
            Webhook para cadastrar no gateway
            <input
              readOnly
              value={`${window.location.origin.replace(/:\d+$/, ':3000')}${config.webhookPath}`}
            />
          </label>
        )}
        {canManage && (
          <div className="form-actions">
            <button className="primary">Salvar integração</button>
          </div>
        )}
      </form>
      <section className="movement-section">
        <h2>Últimas mensagens</h2>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Destino</th>
                <th>Direção</th>
                <th>Status</th>
                <th>Tentativas</th>
                <th>Erro</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {messages.items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                  <td>{item.recipient}</td>
                  <td>{item.direction === 'outbound' ? 'Saída' : 'Entrada'}</td>
                  <td>
                    <span
                      className={`stock-status ${['sent', 'delivered', 'read', 'responded'].includes(item.status) ? 'ok' : item.status === 'created' ? 'low' : 'out'}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{item.attempts}</td>
                  <td>{item.errorMessage ?? '—'}</td>
                  <td>
                    {canSend && ['error', 'failed'].includes(item.status) && (
                      <button className="link" onClick={() => void retry(item.id)}>
                        Reenviar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {messages.items.length === 0 && (
            <div className="empty-row">Nenhuma mensagem processada.</div>
          )}
        </div>
      </section>
    </section>
  );
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha na integração';
}
