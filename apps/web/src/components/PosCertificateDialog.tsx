import { useRef, useState } from 'react';

type CertificateMode = 'a1' | 'a3';

type SessionCertificate =
  { mode: 'a1'; file: File; password: string } | { mode: 'a3'; token: string; password: string };

let sessionCertificate: SessionCertificate | null = null;

export function PosCertificateDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<CertificateMode>('a1');
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'a1' && !file) return setMessage('Selecione o certificado A1 (.pfx ou .p12).');
    if (mode === 'a3' && !token.trim()) return setMessage('Informe o token ou dispositivo A3.');
    if (!password)
      return setMessage(
        mode === 'a1' ? 'Informe a senha do certificado.' : 'Informe a senha/PIN do token.',
      );

    sessionCertificate =
      mode === 'a1' ? { mode, file: file!, password } : { mode, token: token.trim(), password };
    setPassword('');
    setMessage('Certificado carregado com segurança para esta sessão do PDV.');
  }

  function changeMode(nextMode: CertificateMode) {
    setMode(nextMode);
    setFile(null);
    setToken('');
    setPassword('');
    setMessage('');
  }

  const configured = sessionCertificate?.mode === mode;

  return (
    <div className="modal-backdrop pos-modal-layer" role="presentation">
      <section
        className="pos-certificate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-certificate-title"
      >
        <header>
          <div>
            <span className="eyebrow">CONFIGURAÇÃO LOCAL DO PDV</span>
            <h2 id="pos-certificate-title">Certificado digital</h2>
          </div>
          <button type="button" className="quiet" onClick={onClose}>
            Fechar
          </button>
        </header>

        <div className="pos-certificate-modes" role="tablist" aria-label="Tipo de certificado">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'a1'}
            className={mode === 'a1' ? 'active' : ''}
            onClick={() => changeMode('a1')}
          >
            <strong>Certificado A1</strong>
            <small>Arquivo .pfx ou .p12</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'a3'}
            className={mode === 'a3' ? 'active' : ''}
            onClick={() => changeMode('a3')}
          >
            <strong>Token A3</strong>
            <small>Token USB ou cartão</small>
          </button>
        </div>

        <form onSubmit={save}>
          {mode === 'a1' ? (
            <label className="pos-certificate-file" key="certificate-file">
              Arquivo do certificado
              <input
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                required
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setMessage('');
                  requestAnimationFrame(() => passwordRef.current?.focus());
                }}
              />
              <small>{file ? file.name : 'Selecione o arquivo instalado neste computador'}</small>
            </label>
          ) : (
            <label key="certificate-token">
              Token ou dispositivo
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Ex.: SafeNet, GD Starsign, leitora A3"
                autoFocus
                required
              />
            </label>
          )}

          <label>
            {mode === 'a1' ? 'Senha do certificado' : 'Senha/PIN do token'}
            <input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              required
            />
          </label>

          <div className="pos-certificate-security">
            <strong>Proteção da credencial</strong>
            <span>
              A senha/PIN permanece somente na memória desta sessão e não é salva no navegador.
            </span>
          </div>

          {(message || configured) && (
            <p className={`pos-certificate-message ${configured ? 'success' : ''}`} role="status">
              {message || 'Este tipo de certificado já está carregado na sessão.'}
            </p>
          )}

          <footer>
            <button type="button" className="quiet" onClick={onClose}>
              Cancelar (ESC)
            </button>
            <button type="submit" className="primary">
              Carregar certificado
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
