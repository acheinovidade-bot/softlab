import { useEffect, useRef, useState } from 'react';

type Point = { latitude: number; longitude: number };
type MapClick = { latLng?: { lat(): number; lng(): number } };
type MapsApi = {
  Map: new (
    element: HTMLElement,
    options: object,
  ) => {
    addListener(event: string, listener: (event: MapClick) => void): void;
  };
  Marker: new (options: object) => { setPosition(position: object): void };
};

let mapsLoader: Promise<MapsApi> | null = null;

function loadMaps(key: string): Promise<MapsApi> {
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const current = (window as Window & { google?: { maps: MapsApi } }).google?.maps;
    if (current) return resolve(current);
    const callback = `erpGoogleMapsReady${Date.now()}`;
    const target = window as unknown as Window & Record<string, unknown>;
    target[callback] = () => {
      delete target[callback];
      resolve((window as unknown as Window & { google: { maps: MapsApi } }).google.maps);
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callback}`;
    script.async = true;
    script.onerror = () => reject(new Error('Não foi possível carregar o Google Maps'));
    document.head.append(script);
  });
  return mapsLoader;
}

export function GoogleMapPicker({
  value,
  onChange,
}: {
  value: Point | null;
  onChange: (point: Point) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const key = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '');
  useEffect(() => {
    if (!key || !element.current) return;
    let active = true;
    void loadMaps(key)
      .then((maps) => {
        if (!active || !element.current) return;
        const center = value
          ? { lat: value.latitude, lng: value.longitude }
          : { lat: -3.7319, lng: -38.5267 };
        const map = new maps.Map(element.current, {
          center,
          zoom: value ? 15 : 12,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const marker = new maps.Marker({ map, position: center, draggable: true });
        const choose = (event: MapClick) => {
          if (!event.latLng) return;
          const point = { latitude: event.latLng.lat(), longitude: event.latLng.lng() };
          marker.setPosition({ lat: point.latitude, lng: point.longitude });
          onChange(point);
        };
        map.addListener('click', choose);
        (
          marker as unknown as {
            addListener(event: string, listener: (event: MapClick) => void): void;
          }
        ).addListener('dragend', choose);
      })
      .catch(
        (reason: unknown) =>
          active && setError(reason instanceof Error ? reason.message : 'Falha ao carregar o mapa'),
      );
    return () => {
      active = false;
    };
  }, [key]);
  if (!key)
    return (
      <div className="map-key-warning">
        Configure <code>VITE_GOOGLE_MAPS_API_KEY</code> para selecionar o ponto no mapa. As
        coordenadas também podem ser informadas manualmente.
      </div>
    );
  return (
    <>
      <div
        className="google-map-picker"
        ref={element}
        aria-label="Mapa Google para selecionar coordenadas"
      />
      {error && <small className="row-error">{error}</small>}
    </>
  );
}
