import { useRef, useState } from 'react';

const STORAGE_KEY = 'softlab:pos-local-settings';

type Tab = 'general' | 'scale' | 'presale' | 'sat' | 'tef' | 'printing';
type Settings = {
  saveXml: boolean;
  xmlDirectory: string;
  windowMode: string;
  requestCustomerTaxId: string;
  controlLotExpiry: boolean;
  scaleModel: string;
  scalePort: string;
  scaleSpeed: string;
  importLocalPresale: boolean;
  presaleServer: string;
  satEnabled: boolean;
  satLibrary: string;
  satActivationCode: string;
  satSignature: string;
  tefMode: string;
  pinPadPort: string;
  tefPrinting: string;
  reducedReceipt: boolean;
  printer: string;
  printerModel: string;
  preview: boolean;
  openDrawer: boolean;
  paperSize: string;
  leftMargin: number;
  exchangeReceipt: string;
  exchangeGrouping: string;
  printDeliveryOrder: boolean;
  numberingSequence: string;
  danfceLayout: string;
  openPrintOptions: boolean;
  copies: number;
};

const defaults: Settings = {
  saveXml: true,
  xmlDirectory: 'C:\\ProgramData\\SoftLab Varejo\\XML',
  windowMode: 'Janela normal',
  requestCustomerTaxId: 'Final da venda',
  controlLotExpiry: false,
  scaleModel: 'Nenhum',
  scalePort: 'AUTO',
  scaleSpeed: '9600',
  importLocalPresale: false,
  presaleServer: 'localhost',
  satEnabled: false,
  satLibrary: '',
  satActivationCode: '',
  satSignature: '',
  tefMode: 'Desabilitado',
  pinPadPort: 'AUTO',
  tefPrinting: 'Imprimir todas as vias',
  reducedReceipt: true,
  printer: 'SEM IMPRESSORA',
  printerModel: 'Genérica',
  preview: false,
  openDrawer: false,
  paperSize: '80mm',
  leftMargin: 4,
  exchangeReceipt: 'Não imprimir',
  exchangeGrouping: 'item',
  printDeliveryOrder: false,
  numberingSequence: '',
  danfceLayout: 'Normal',
  openPrintOptions: false,
  copies: 1,
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'Geral' },
  { id: 'scale', label: 'Balança checkout' },
  { id: 'presale', label: 'Pré-venda desktop' },
  { id: 'sat', label: 'S@T/MFe' },
  { id: 'tef', label: 'TEF' },
  { id: 'printing', label: 'Impressão' },
];

export function PosSettingsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [notice, setNotice] = useState('');
  const directoryRef = useRef<HTMLInputElement>(null);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));
  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('softlab:pos-settings-saved', { detail: settings }));
    setNotice('Configurações salvas neste computador.');
  };

  return (
    <div className="modal-backdrop pos-modal-layer" role="presentation">
      <section
        className="pos-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Configurações do PDV"
      >
        <button className="pos-settings-close" type="button" aria-label="Fechar" onClick={onClose}>
          ×
        </button>
        <nav aria-label="Categorias de configuração">
          {tabs.map((item) => (
            <button
              type="button"
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="pos-settings-content">
          {tab === 'general' && (
            <div className="pos-settings-grid one-column">
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.saveXml}
                  onChange={(e) => update('saveXml', e.target.checked)}
                />{' '}
                Salvar arquivos XML localmente
              </label>
              <label>
                Diretório
                <div className="inline-field">
                  <input
                    ref={directoryRef}
                    value={settings.xmlDirectory}
                    onChange={(e) => update('xmlDirectory', e.target.value)}
                  />
                  <button type="button" onClick={() => directoryRef.current?.focus()}>
                    Alterar
                  </button>
                </div>
              </label>
              <label>
                Formato da tela ao iniciar
                <select
                  value={settings.windowMode}
                  onChange={(e) => update('windowMode', e.target.value)}
                >
                  <option>Janela normal</option>
                  <option>Maximizada</option>
                  <option>Tela cheia</option>
                </select>
              </label>
              <label>
                Solicitar CPF do cliente
                <select
                  value={settings.requestCustomerTaxId}
                  onChange={(e) => update('requestCustomerTaxId', e.target.value)}
                >
                  <option>Não solicitar</option>
                  <option>Início da venda</option>
                  <option>Final da venda</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.controlLotExpiry}
                  onChange={(e) => update('controlLotExpiry', e.target.checked)}
                />{' '}
                Controlar lote e validade no PDV
              </label>
            </div>
          )}
          {tab === 'scale' && (
            <div className="pos-settings-grid one-column">
              <label>
                Modelo
                <select
                  value={settings.scaleModel}
                  onChange={(e) => update('scaleModel', e.target.value)}
                >
                  <option>Nenhum</option>
                  <option>Toledo</option>
                  <option>Filizola</option>
                  <option>Urano</option>
                  <option>Elgin</option>
                </select>
              </label>
              <div className="inline-fields">
                <label>
                  Porta
                  <select
                    value={settings.scalePort}
                    onChange={(e) => update('scalePort', e.target.value)}
                  >
                    <option>AUTO</option>
                    {['COM1', 'COM2', 'COM3', 'COM4', 'COM5'].map((port) => (
                      <option key={port}>{port}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Velocidade
                  <select
                    value={settings.scaleSpeed}
                    onChange={(e) => update('scaleSpeed', e.target.value)}
                  >
                    {['9600', '19200', '38400', '57600', '115200'].map((speed) => (
                      <option key={speed}>{speed}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
          {tab === 'presale' && (
            <div className="pos-settings-grid one-column">
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.importLocalPresale}
                  onChange={(e) => update('importLocalPresale', e.target.checked)}
                />{' '}
                Importar pré-venda local
              </label>
              <label>
                SERVIDOR
                <input
                  value={settings.presaleServer}
                  onChange={(e) => update('presaleServer', e.target.value)}
                />
                <small>Ex.: localhost, 127.0.0.1, 10.0.0.1</small>
              </label>
              <button
                type="button"
                className="primary test-connection"
                onClick={() =>
                  setNotice(
                    settings.presaleServer.trim()
                      ? `Conexão com ${settings.presaleServer} configurada.`
                      : 'Informe o servidor.',
                  )
                }
              >
                Testar conexão
              </button>
            </div>
          )}
          {tab === 'sat' && (
            <div className="pos-settings-grid two-columns">
              <label className="check full">
                <input
                  type="checkbox"
                  checked={settings.satEnabled}
                  onChange={(e) => update('satEnabled', e.target.checked)}
                />{' '}
                Habilitar S@T/MFe
              </label>
              <label>
                Biblioteca / equipamento
                <input
                  value={settings.satLibrary}
                  onChange={(e) => update('satLibrary', e.target.value)}
                  placeholder="DLL do fabricante"
                />
              </label>
              <label>
                Código de ativação
                <input
                  type="password"
                  value={settings.satActivationCode}
                  onChange={(e) => update('satActivationCode', e.target.value)}
                />
              </label>
              <label className="full">
                Assinatura AC
                <input
                  value={settings.satSignature}
                  onChange={(e) => update('satSignature', e.target.value)}
                />
              </label>
            </div>
          )}
          {tab === 'tef' && (
            <div className="pos-settings-grid tef-grid">
              <label>
                TEF
                <select
                  value={settings.tefMode}
                  onChange={(e) => update('tefMode', e.target.value)}
                >
                  <option>Desabilitado</option>
                  <option>Sitef</option>
                  <option>PayGo</option>
                  <option>Cappta</option>
                </select>
              </label>
              <label>
                Porta do Pin Pad
                <select
                  value={settings.pinPadPort}
                  onChange={(e) => update('pinPadPort', e.target.value)}
                >
                  <option>AUTO</option>
                  {['COM1', 'COM2', 'COM3', 'COM4'].map((port) => (
                    <option key={port}>{port}</option>
                  ))}
                </select>
              </label>
              <label>
                Impressão
                <select
                  value={settings.tefPrinting}
                  onChange={(e) => update('tefPrinting', e.target.value)}
                >
                  <option>Imprimir todas as vias</option>
                  <option>Somente via do cliente</option>
                  <option>Não imprimir</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.reducedReceipt}
                  onChange={(e) => update('reducedReceipt', e.target.checked)}
                />{' '}
                Cupom reduzido
              </label>
              <em className="full">
                As configurações de TEF terão efeito após a reinicialização do PDV.
              </em>
            </div>
          )}
          {tab === 'printing' && (
            <div className="pos-settings-grid two-columns printing-grid">
              <label>
                Impressora
                <select
                  value={settings.printer}
                  onChange={(e) => update('printer', e.target.value)}
                >
                  <option>SEM IMPRESSORA</option>
                  <option>Impressora padrão do Windows</option>
                  <option>SOFTLAB Print Service</option>
                </select>
              </label>
              <label>
                Modelo
                <select
                  value={settings.printerModel}
                  onChange={(e) => update('printerModel', e.target.value)}
                >
                  <option>Genérica</option>
                  <option>Epson ESC/POS</option>
                  <option>Elgin</option>
                  <option>Bematech</option>
                </select>
              </label>
              <div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.preview}
                    onChange={(e) => update('preview', e.target.checked)}
                  />{' '}
                  Preview
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.openDrawer}
                    onChange={(e) => update('openDrawer', e.target.checked)}
                  />{' '}
                  Habilitar gaveta
                </label>
              </div>
              <div>
                <span>Tamanho da impressão</span>
                <div className="inline-fields">
                  <label className="check">
                    <input
                      type="radio"
                      name="paper"
                      checked={settings.paperSize === '80mm'}
                      onChange={() => update('paperSize', '80mm')}
                    />{' '}
                    80mm
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name="paper"
                      checked={settings.paperSize === '58mm'}
                      onChange={() => update('paperSize', '58mm')}
                    />{' '}
                    58mm
                  </label>
                  <label>
                    Margem esquerda
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={settings.leftMargin}
                      onChange={(e) => update('leftMargin', Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>
              <div>
                <label>
                  Cupom de troca
                  <select
                    value={settings.exchangeReceipt}
                    onChange={(e) => update('exchangeReceipt', e.target.value)}
                  >
                    <option>Não imprimir</option>
                    <option>Imprimir automaticamente</option>
                    <option>Perguntar ao finalizar</option>
                  </select>
                </label>
                <div className="inline-fields">
                  <label className="check">
                    <input
                      type="radio"
                      name="group"
                      checked={settings.exchangeGrouping === 'item'}
                      onChange={() => update('exchangeGrouping', 'item')}
                    />{' '}
                    Por item
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name="group"
                      checked={settings.exchangeGrouping === 'receipt'}
                      onChange={() => update('exchangeGrouping', 'receipt')}
                    />{' '}
                    Cupom
                  </label>
                </div>
              </div>
              <div>
                <span>Padrão impressão DANFCe</span>
                <div className="inline-fields">
                  <label className="check">
                    <input
                      type="radio"
                      name="danfce"
                      checked={settings.danfceLayout === 'Normal'}
                      onChange={() => update('danfceLayout', 'Normal')}
                    />{' '}
                    Normal
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name="danfce"
                      checked={settings.danfceLayout === 'Resumido'}
                      onChange={() => update('danfceLayout', 'Resumido')}
                    />{' '}
                    Resumido
                  </label>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.openPrintOptions}
                    onChange={(e) => update('openPrintOptions', e.target.checked)}
                  />{' '}
                  Abrir opções de impressão ao transmitir
                </label>
              </div>
              <div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.printDeliveryOrder}
                    onChange={(e) => update('printDeliveryOrder', e.target.checked)}
                  />{' '}
                  Imprimir número do pedido para entrega
                </label>
                <label>
                  Sequência da numeração
                  <input
                    value={settings.numberingSequence}
                    onChange={(e) => update('numberingSequence', e.target.value)}
                  />
                </label>
              </div>
              <label>
                Quantidade de vias (Venda)
                <input
                  type="number"
                  min="1"
                  max="9"
                  value={settings.copies}
                  onChange={(e) => update('copies', Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </div>
        {notice && (
          <p className="pos-settings-notice" role="status">
            {notice}
          </p>
        )}
        <footer>
          <button type="button" className="quiet" onClick={onClose}>
            SAIR
          </button>
          <button type="button" className="primary" onClick={save}>
            SALVAR
          </button>
        </footer>
      </section>
    </div>
  );
}

function readSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>;
    return { ...defaults, ...stored };
  } catch {
    return defaults;
  }
}
