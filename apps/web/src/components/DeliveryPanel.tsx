import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api';
import { GoogleMapPicker } from './GoogleMapPicker';

type Delivery = {
  id: string;
  status: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  address: string;
  driverId: string | null;
  driverName: string | null;
  fee: string;
  distanceKm: string | null;
  promisedAt: string | null;
  createdAt: string;
};
type Driver = { id: string; name: string; phone: string | null };
type Zone = { id: string; name: string; calculationType: string; fee: string };
type Order = {
  id: string;
  number: string;
  total: string;
  customerName: string;
  addresses: Array<{
    id: string;
    label: string;
    latitude: string | null;
    longitude: string | null;
  }>;
};
type Overview = { deliveries: Delivery[]; drivers: Driver[]; zones: Zone[]; orders: Order[] };

const columns = [
  ['new', 'Novo'],
  ['confirmed', 'Confirmado'],
  ['preparing', 'Preparando'],
  ['ready', 'Pronto'],
  ['out_for_delivery', 'Em entrega'],
  ['delivered', 'Finalizado'],
] as const;
const next: Record<string, string> = {
  new: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

export function DeliveryPanel({
  canOperate,
  canManage,
}: {
  canOperate: boolean;
  canManage: boolean;
}) {
  const [data, setData] = useState<Overview>({
    deliveries: [],
    drivers: [],
    zones: [],
    orders: [],
  });
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [dispatching, setDispatching] = useState<Delivery | null>(null);
  const [addressId, setAddressId] = useState('');
  const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [zoneType, setZoneType] = useState('neighborhood');
  const [zoneCenter, setZoneCenter] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const order = useMemo(
    () => data.orders.find((item) => item.id === orderId),
    [data.orders, orderId],
  );
  async function load() {
    try {
      setData(await apiRequest<Overview>('/delivery/overview'));
    } catch (reason) {
      setError(message(reason));
    }
  }
  useEffect(() => void load(), []);
  async function post(path: string, body: unknown, key = path) {
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
  async function advance(delivery: Delivery) {
    const toStatus = next[delivery.status];
    if (!toStatus) return;
    if (toStatus === 'out_for_delivery') {
      setDispatching(delivery);
      return;
    }
    await post(`/delivery/${delivery.id}/transition`, { toStatus, driverId: null }, delivery.id);
  }
  return (
    <section className="delivery-screen">
      <header className="delivery-header">
        <div>
          <span className="eyebrow">DELIVERY E LOGÍSTICA</span>
          <h1>Kanban de entregas</h1>
          <p>Do pedido confirmado à entrega, com taxa automática e rastreabilidade operacional.</p>
        </div>
        <div className="delivery-kpis">
          <span>
            <b>{data.deliveries.filter((item) => item.status !== 'delivered').length}</b> em
            andamento
          </span>
          <span>
            <b>{data.drivers.length}</b> entregadores
          </span>
          <span>
            <b>{data.zones.length}</b> zonas
          </span>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {canOperate && (
        <form
          className="delivery-create"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void post(
              '/delivery',
              {
                orderId: form.get('orderId'),
                addressId: form.get('addressId'),
                distanceKm: form.get('distanceKm') || null,
                promisedAt: form.get('promisedAt') || null,
                latitude: destination?.latitude ?? null,
                longitude: destination?.longitude ?? null,
              },
              'create',
            ).then((ok) => {
              if (ok) {
                setOrderId('');
                setAddressId('');
                setDestination(null);
                event.currentTarget.reset();
              }
            });
          }}
        >
          <div>
            <span className="eyebrow">NOVA ENTREGA</span>
            <h2>Vincular pedido pronto</h2>
          </div>
          <label>
            Pedido
            <select
              name="orderId"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {data.orders.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} · {item.customerName} · {money(item.total)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Endereço
            <select
              name="addressId"
              value={addressId}
              required
              disabled={!order}
              onChange={(event) => {
                const id = event.target.value;
                setAddressId(id);
                const address = order?.addresses.find((item) => item.id === id);
                setDestination(
                  address?.latitude && address?.longitude
                    ? { latitude: Number(address.latitude), longitude: Number(address.longitude) }
                    : null,
                );
              }}
            >
              <option value="">Selecione</option>
              {order?.addresses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {addressId && (
            <div className="delivery-map-field">
              <span>Localização do endereço no Google Maps</span>
              <GoogleMapPicker value={destination} onChange={setDestination} />
              <CoordinateFields value={destination} onChange={setDestination} prefix="endereço" />
            </div>
          )}
          <label>
            Distância km
            <input name="distanceKm" type="number" min="0" max="500" step="0.1" />
          </label>
          <label>
            Prometida para
            <input name="promisedAt" type="datetime-local" />
          </label>
          <button className="primary" disabled={busy === 'create' || !orderId}>
            {busy === 'create' ? 'Criando…' : 'Criar entrega'}
          </button>
        </form>
      )}
      <div className="delivery-board">
        {columns.map(([status, label]) => (
          <section className={`delivery-column status-${status}`} key={status}>
            <header>
              <strong>{label}</strong>
              <span>{data.deliveries.filter((item) => item.status === status).length}</span>
            </header>
            <div>
              {data.deliveries
                .filter((item) => item.status === status)
                .map((item) => (
                  <article className="delivery-card" key={item.id}>
                    <span className="delivery-order">{item.orderNumber}</span>
                    <h3>{item.customerName}</h3>
                    <p>{item.address}</p>
                    <div className="delivery-meta">
                      <span>
                        Taxa <b>{money(item.fee)}</b>
                      </span>
                      {item.distanceKm && (
                        <span>{Number(item.distanceKm).toLocaleString('pt-BR')} km</span>
                      )}
                      {item.driverName && <span>🛵 {item.driverName}</span>}
                    </div>
                    {item.promisedAt && (
                      <small>Prazo {new Date(item.promisedAt).toLocaleString('pt-BR')}</small>
                    )}
                    {canOperate && next[item.status] && (
                      <button
                        className="delivery-next"
                        disabled={busy === item.id}
                        onClick={() => void advance(item)}
                      >
                        {busy === item.id
                          ? 'Atualizando…'
                          : item.status === 'ready'
                            ? 'Selecionar entregador →'
                            : 'Avançar →'}
                      </button>
                    )}
                  </article>
                ))}
              {data.deliveries.every((item) => item.status !== status) && (
                <div className="delivery-empty">Nenhuma entrega</div>
              )}
            </div>
          </section>
        ))}
      </div>
      {canManage && (
        <div className="delivery-settings">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              void post(
                '/delivery/drivers',
                { name: f.get('name'), phone: f.get('phone') || null, employeeId: null },
                'driver',
              ).then((ok) => ok && event.currentTarget.reset());
            }}
          >
            <h2>Novo entregador</h2>
            <input name="name" placeholder="Nome" required />
            <input name="phone" placeholder="Telefone" />
            <button className="quiet" disabled={busy === 'driver'}>
              Cadastrar
            </button>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              const type = formText(f, 'calculationType');
              void post(
                '/delivery/zones',
                {
                  name: f.get('name'),
                  calculationType: type,
                  values: formText(f, 'values')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                  maxDistanceKm: f.get('maxDistanceKm') || null,
                  centerLatitude: zoneCenter?.latitude ?? null,
                  centerLongitude: zoneCenter?.longitude ?? null,
                  fee: f.get('fee'),
                },
                'zone',
              ).then((ok) => ok && event.currentTarget.reset());
            }}
          >
            <h2>Nova zona de entrega</h2>
            <input name="name" placeholder="Nome da zona" required />
            <select
              name="calculationType"
              value={zoneType}
              onChange={(event) => setZoneType(event.target.value)}
            >
              <option value="neighborhood">Por bairro</option>
              <option value="postal_code">Por CEP</option>
              <option value="distance">Por distância</option>
              <option value="radius">Por raio</option>
            </select>
            {(zoneType === 'neighborhood' || zoneType === 'postal_code') && (
              <input
                name="values"
                placeholder={
                  zoneType === 'neighborhood'
                    ? 'Bairros separados por vírgula'
                    : 'CEPs separados por vírgula'
                }
              />
            )}
            <input
              name="maxDistanceKm"
              type="number"
              min="0.1"
              step="0.1"
              placeholder="Distância máxima"
            />
            {zoneType === 'radius' && (
              <div className="delivery-map-field">
                <span>Centro do raio no Google Maps</span>
                <GoogleMapPicker value={zoneCenter} onChange={setZoneCenter} />
                <CoordinateFields value={zoneCenter} onChange={setZoneCenter} prefix="centro" />
              </div>
            )}
            <input name="fee" type="number" min="0" step="0.01" placeholder="Taxa R$" required />
            <button className="quiet" disabled={busy === 'zone'}>
              Cadastrar zona
            </button>
          </form>
        </div>
      )}
      {dispatching && (
        <div
          className="food-summary-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-dispatch-title"
        >
          <form
            className="delivery-dispatch"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const driverId = formText(form, 'driverId');
              void post(
                `/delivery/${dispatching.id}/transition`,
                { toStatus: 'out_for_delivery', driverId },
                dispatching.id,
              ).then((ok) => ok && setDispatching(null));
            }}
          >
            <span className="eyebrow">DESPACHO</span>
            <h2 id="delivery-dispatch-title">Selecionar entregador</h2>
            <p>
              <b>{dispatching.orderNumber}</b> · {dispatching.customerName}
            </p>
            <label>
              Entregador
              <select name="driverId" required autoFocus>
                <option value="">Selecione</option>
                {data.drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                    {driver.phone ? ` · ${driver.phone}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {data.drivers.length === 0 && (
              <small>Cadastre um entregador nas configurações antes de iniciar a rota.</small>
            )}
            <div className="delivery-dispatch-actions">
              <button type="button" className="quiet" onClick={() => setDispatching(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={busy === dispatching.id || data.drivers.length === 0}
              >
                {busy === dispatching.id ? 'Iniciando…' : 'Iniciar entrega'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha no Delivery';
}

function CoordinateFields({
  value,
  onChange,
  prefix,
}: {
  value: { latitude: number; longitude: number } | null;
  onChange: (value: { latitude: number; longitude: number }) => void;
  prefix: string;
}) {
  return (
    <div className="coordinate-fields">
      <input
        aria-label={`Latitude do ${prefix}`}
        type="number"
        step="0.0000001"
        placeholder="Latitude"
        value={value?.latitude ?? ''}
        onChange={(event) =>
          onChange({ latitude: Number(event.target.value), longitude: value?.longitude ?? 0 })
        }
      />
      <input
        aria-label={`Longitude do ${prefix}`}
        type="number"
        step="0.0000001"
        placeholder="Longitude"
        value={value?.longitude ?? ''}
        onChange={(event) =>
          onChange({ latitude: value?.latitude ?? 0, longitude: Number(event.target.value) })
        }
      />
    </div>
  );
}

function formText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
