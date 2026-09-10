import { useState } from 'react';
import { DeliverySettingsPanel } from './DeliverySettingsPanel';
import { PosSettingsPanel } from './PosSettingsPanel';
import { WhatsappIntegrationPanel } from './WhatsappIntegrationPanel';

type SettingsTab = 'pos' | 'delivery' | 'whatsapp' | 'system';
type Destination = 'subscription' | 'branches' | 'users' | 'roles';

export function SystemSettingsPanel({
  canManagePos,
  canReadDelivery,
  canManageDelivery,
  canReadWhatsapp,
  canManageWhatsapp,
  canSendWhatsapp,
  destinations,
  onNavigate,
}: {
  canManagePos: boolean;
  canReadDelivery: boolean;
  canManageDelivery: boolean;
  canReadWhatsapp: boolean;
  canManageWhatsapp: boolean;
  canSendWhatsapp: boolean;
  destinations: Destination[];
  onNavigate: (destination: Destination) => void;
}) {
  const tabs = [
    { id: 'pos' as const, label: 'PDV' },
    canReadDelivery && { id: 'delivery' as const, label: 'Delivery' },
    canReadWhatsapp && { id: 'whatsapp' as const, label: 'WhatsApp' },
    destinations.length > 0 && { id: 'system' as const, label: 'Sistema' },
  ].filter((tab): tab is { id: SettingsTab; label: string } => Boolean(tab));
  const [tab, setTab] = useState<SettingsTab>(tabs[0]?.id ?? 'pos');

  return (
    <section className="system-settings">
      <header className="settings-header">
        <div>
          <span className="eyebrow">CENTRAL DE CONFIGURAÇÕES</span>
          <h1>Configurações do sistema</h1>
          <p>Parâmetros operacionais organizados fora das telas de venda e atendimento.</p>
        </div>
      </header>
      <nav className="settings-tabs" aria-label="Categorias de configuração">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === 'pos' && <PosSettingsPanel canManage={canManagePos} />}
      {tab === 'delivery' && canReadDelivery && (
        <DeliverySettingsPanel canManage={canManageDelivery} />
      )}
      {tab === 'whatsapp' && canReadWhatsapp && (
        <WhatsappIntegrationPanel canManage={canManageWhatsapp} canSend={canSendWhatsapp} />
      )}
      {tab === 'system' && (
        <section className="system-settings-card">
          <header>
            <span className="eyebrow">ADMINISTRAÇÃO</span>
            <h2>Cadastros e segurança do sistema</h2>
            <p>Acesse as parametrizações administrativas disponíveis para o seu perfil.</p>
          </header>
          <div className="settings-destinations">
            {destinations.includes('subscription') && (
              <button type="button" onClick={() => onNavigate('subscription')}>
                <strong>Plano e módulos</strong><span>Consumo e recursos contratados</span>
              </button>
            )}
            {destinations.includes('branches') && (
              <button type="button" onClick={() => onNavigate('branches')}>
                <strong>Filiais</strong><span>Empresas, lojas e unidades</span>
              </button>
            )}
            {destinations.includes('users') && (
              <button type="button" onClick={() => onNavigate('users')}>
                <strong>Usuários</strong><span>Acesso das pessoas ao ERP</span>
              </button>
            )}
            {destinations.includes('roles') && (
              <button type="button" onClick={() => onNavigate('roles')}>
                <strong>Perfis e permissões</strong><span>Regras de segurança por função</span>
              </button>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
