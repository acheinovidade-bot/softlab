import { useEffect, useState } from 'react';
import {
  listWindowsPrinters,
  readSectorPrinters,
  saveSectorPrinters,
  type SectorPrinter,
} from '../food-printing';

export function PrintManagerPanel({
  sectors,
  onClose,
}: {
  sectors: string[];
  onClose: () => void;
}) {
  const [printers, setPrinters] = useState<string[]>([]);
  const [mapping, setMapping] = useState<SectorPrinter[]>(readSectorPrinters);
  const [status, setStatus] = useState('Conectando ao gerenciador Windows…');
  useEffect(() => {
    void listWindowsPrinters()
      .then((items) => {
        setPrinters(items);
        setStatus(
          items.length ? 'Gerenciador conectado' : 'Nenhuma impressora instalada no Windows',
        );
      })
      .catch(() => setStatus('Instale ou inicie o Gerenciador de Impressão Windows'));
  }, []);
  function selected(sector: string) {
    return mapping.find((item) => item.sector === sector)?.printer ?? '';
  }
  function change(sector: string, printer: string) {
    setMapping((current) => [
      ...current.filter((item) => item.sector !== sector),
      ...(printer ? [{ sector, printer }] : []),
    ]);
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="print-manager-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Gerenciador de impressão"
      >
        <header>
          <div>
            <span className="eyebrow">FOOD SERVICE</span>
            <h2>Impressão por setor</h2>
          </div>
          <button className="quiet" onClick={onClose}>
            Fechar
          </button>
        </header>
        <p className={status === 'Gerenciador conectado' ? 'success-text' : 'muted'}>{status}</p>
        <div className="print-sector-list">
          {sectors.map((sector) => (
            <label key={sector}>
              <span>
                <strong>{sector}</strong>
                <small>Pedidos enviados automaticamente</small>
              </span>
              <select
                value={selected(sector)}
                onChange={(event) => change(sector, event.target.value)}
              >
                <option value="">Não imprimir</option>
                {printers.map((printer) => (
                  <option key={printer}>{printer}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <footer>
          <button
            className="primary"
            onClick={() => {
              saveSectorPrinters(mapping);
              onClose();
            }}
          >
            Salvar configuração
          </button>
        </footer>
      </section>
    </div>
  );
}
