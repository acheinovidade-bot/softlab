import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { GoogleMapPicker } from './GoogleMapPicker';

type DeliverySettingsLookup = {
  drivers: Array<{ id: string; name: string; phone: string | null }>;
  zones: Array<{ id: string; name: string; calculationType: string; fee: string }>;
};

export function DeliverySettingsPanel({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<DeliverySettingsLookup>({ drivers: [], zones: [] });
  const [zoneType, setZoneType] = useState('neighborhood');
  const [zoneCenter, setZoneCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const overview = await apiRequest<DeliverySettingsLookup>('/delivery/overview');
      setData({ drivers: overview.drivers, zones: overview.zones });
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => void load(), []);

  async function post(path: string, body: unknown, key: string) {
    setBusy(key);
    setError('');
    try {
      await apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
      await load();
      return true;
    } catch (reason) {
      setError(message(reason));
      return false;
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="system-settings-card">
      <header>
        <span className="eyebrow">CONFIGURAÇÕES DE DELIVERY</span>
        <h2>Entregadores e taxas por região</h2>
        <p>{data.drivers.length} entregadores · {data.zones.length} zonas configuradas</p>
      </header>
      {error && <div className="error">{error}</div>}
      {!canManage && <p>Seu perfil permite consultar, mas não alterar estas configurações.</p>}
      {canManage && (
        <div className="delivery-settings">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void post(
                '/delivery/drivers',
                { name: form.get('name'), phone: form.get('phone') || null, employeeId: null },
                'driver',
              ).then((ok) => ok && event.currentTarget.reset());
            }}
          >
            <h2>Novo entregador</h2>
            <input name="name" placeholder="Nome" required />
            <input name="phone" placeholder="Telefone" />
            <button className="quiet" disabled={busy === 'driver'}>Cadastrar</button>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const calculationType = text(form, 'calculationType');
              void post(
                '/delivery/zones',
                {
                  name: form.get('name'),
                  calculationType,
                  values: text(form, 'values').split(',').map((item) => item.trim()).filter(Boolean),
                  maxDistanceKm: form.get('maxDistanceKm') || null,
                  centerLatitude: zoneCenter?.latitude ?? null,
                  centerLongitude: zoneCenter?.longitude ?? null,
                  fee: form.get('fee'),
                },
                'zone',
              ).then((ok) => ok && event.currentTarget.reset());
            }}
          >
            <h2>Nova zona de entrega</h2>
            <input name="name" placeholder="Nome da zona" required />
            <select name="calculationType" value={zoneType} onChange={(event) => setZoneType(event.target.value)}>
              <option value="neighborhood">Por bairro</option>
              <option value="postal_code">Por CEP</option>
              <option value="distance">Por distância</option>
              <option value="radius">Por raio</option>
            </select>
            {(zoneType === 'neighborhood' || zoneType === 'postal_code') && (
              <input
                name="values"
                placeholder={zoneType === 'neighborhood' ? 'Bairros separados por vírgula' : 'CEPs separados por vírgula'}
              />
            )}
            <input name="maxDistanceKm" type="number" min="0.1" step="0.1" placeholder="Distância máxima" />
            {zoneType === 'radius' && (
              <div className="delivery-map-field">
                <span>Centro do raio no Google Maps</span>
                <GoogleMapPicker value={zoneCenter} onChange={setZoneCenter} />
                <div className="coordinate-fields">
                  <input
                    aria-label="Latitude do centro"
                    type="number"
                    step="0.0000001"
                    placeholder="Latitude"
                    value={zoneCenter?.latitude ?? ''}
                    onChange={(event) => setZoneCenter({ latitude: Number(event.target.value), longitude: zoneCenter?.longitude ?? 0 })}
                  />
                  <input
                    aria-label="Longitude do centro"
                    type="number"
                    step="0.0000001"
                    placeholder="Longitude"
                    value={zoneCenter?.longitude ?? ''}
                    onChange={(event) => setZoneCenter({ latitude: zoneCenter?.latitude ?? 0, longitude: Number(event.target.value) })}
                  />
                </div>
              </div>
            )}
            <input name="fee" type="number" min="0" step="0.01" placeholder="Taxa R$" required />
            <button className="quiet" disabled={busy === 'zone'}>Cadastrar zona</button>
          </form>
        </div>
      )}
    </section>
  );
}

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha nas configurações de Delivery';
}
