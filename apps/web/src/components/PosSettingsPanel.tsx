import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

type PosSettings = {
  defaultCustomerId: string | null;
  defaultSellerId: string | null;
  defaultLocationId: string | null;
};

type PosLookup = {
  customers: Array<{ id: string; name: string }>;
  sellers: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; code: string; name: string }>;
  settings?: PosSettings;
};

export function PosSettingsPanel({ canManage }: { canManage: boolean }) {
  const [lookup, setLookup] = useState<PosLookup>({ customers: [], sellers: [], locations: [] });
  const [settings, setSettings] = useState<PosSettings>({
    defaultCustomerId: null,
    defaultSellerId: null,
    defaultLocationId: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void apiRequest<PosLookup>('/sales/pos/lookups')
      .then((data) => {
        setLookup(data);
        setSettings({
          defaultCustomerId: data.settings?.defaultCustomerId ?? null,
          defaultSellerId: data.settings?.defaultSellerId ?? data.sellers[0]?.id ?? null,
          defaultLocationId: data.settings?.defaultLocationId ?? data.locations[0]?.id ?? null,
        });
      })
      .catch((reason) => setError(message(reason)));
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings.defaultSellerId || !settings.defaultLocationId) {
      setError('Cadastre ao menos um vendedor e um local de estoque antes de salvar.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await apiRequest<PosSettings>('/sales/pos/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSettings(saved);
      setNotice('Padrões do PDV salvos para esta filial.');
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="system-settings-card">
      <header>
        <span className="eyebrow">CONFIGURAÇÕES DO PDV</span>
        <h2>Operação automática da venda</h2>
        <p>
          Estes padrões são aplicados em todas as novas vendas, sem exigir seleção no caixa.
        </p>
      </header>
      {error && <div className="error">{error}</div>}
      {notice && <p className="success-message">{notice}</p>}
      <form className="settings-form" onSubmit={(event) => void save(event)}>
        <label>
          Vendedor padrão
          <select
            required
            disabled={!canManage}
            value={settings.defaultSellerId ?? ''}
            onChange={(event) =>
              setSettings((current) => ({ ...current, defaultSellerId: event.target.value || null }))
            }
          >
            <option value="">Selecione</option>
            {lookup.sellers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Local de estoque padrão
          <select
            required
            disabled={!canManage}
            value={settings.defaultLocationId ?? ''}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                defaultLocationId: event.target.value || null,
              }))
            }
          >
            <option value="">Selecione</option>
            {lookup.locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente padrão
          <select
            disabled={!canManage}
            value={settings.defaultCustomerId ?? ''}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                defaultCustomerId: event.target.value || null,
              }))
            }
          >
            <option value="">Consumidor não identificado</option>
            {lookup.customers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {canManage && (
          <button className="primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar configurações do PDV'}
          </button>
        )}
      </form>
    </section>
  );
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha ao carregar configurações do PDV';
}
