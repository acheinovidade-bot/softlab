import { useEffect, useState } from 'react';
import type { CurrentUser } from '@erp/contracts';
import { BranchesPanel } from './BranchesPanel';
import { RolesPanel } from './RolesPanel';
import { UsersPanel } from './UsersPanel';
import { SubscriptionPanel } from './SubscriptionPanel';
import { CustomersPanel, EmployeesPanel, SuppliersPanel } from './MasterDataPanels';
import { ProductsPanel } from './ProductsPanel';
import { StockPanel } from './StockPanel';
import { PurchaseXmlPanel } from './PurchaseXmlPanel';
import { PurchaseSuggestionPanel } from './PurchaseSuggestionPanel';
import { QuotationPanel } from './QuotationPanel';
import { WhatsappIntegrationPanel } from './WhatsappIntegrationPanel';
import { ProductionPanel } from './ProductionPanel';
import { SalesPanel } from './SalesPanel';
import { PosPanel } from './PosPanel';
import { CashPanel } from './CashPanel';
import { FoodServicePanel } from './FoodServicePanel';
import { DeliveryPanel } from './DeliveryPanel';
import { SalesForceApp } from './SalesForceApp';
import { SystemSettingsPanel } from './SystemSettingsPanel';
import {
  isWorkspaceSection,
  ModuleWorkspacePanel,
  type WorkspaceSection,
} from './ModuleWorkspacePanel';
import { PaymentConfigurationPanel } from './PaymentConfigurationPanel';
import { CashOperationsPanel } from './CashOperationsPanel';

export type Section =
  | 'subscription'
  | 'products'
  | 'stock'
  | 'purchase-suggestions'
  | 'quotations'
  | 'whatsapp'
  | 'production'
  | 'sales-flow'
  | 'sales-force'
  | 'pos'
  | 'cash'
  | 'food'
  | 'delivery'
  | 'settings'
  | 'purchase-xml'
  | 'customers'
  | 'suppliers'
  | 'employees'
  | 'branches'
  | 'users'
  | 'roles'
  | 'card-operators'
  | 'payment-finalizers'
  | 'pos-operations'
  | 'cash-tape'
  | WorkspaceSection;

type NavigationItem = { id: Section; label: string };

const navigationGroups: Array<{
  label: string;
  icon: NavIconName;
  sections: Section[];
}> = [
  {
    label: 'Pessoas',
    icon: 'people',
    sections: ['customers', 'suppliers', 'employees', 'returns', 'loyalty'],
  },
  {
    label: 'Logística',
    icon: 'box',
    sections: ['products', 'stock', 'delivery'],
  },
  {
    label: 'Compras e Produção',
    icon: 'cart',
    sections: [
      'purchase-orders',
      'quotations',
      'purchase-suggestions',
      'production',
      'purchase-analysis',
    ],
  },
  {
    label: 'Comercial',
    icon: 'chart',
    sections: [
      'sales-flow',
      'sales-force',
      'consignments',
      'pre-sales',
      'invoicing',
      'commissions',
      'promotions',
    ],
  },
  {
    label: 'Frente de Caixa',
    icon: 'register',
    sections: [
      'pos',
      'pos-operations',
      'cash',
      'cash-tape',
      'card-operators',
      'payment-finalizers',
      'food',
    ],
  },
  {
    label: 'Fiscal',
    icon: 'document',
    sections: [
      'fiscal-documents',
      'fiscal-issuance',
      'purchase-xml',
      'inbound-nfe',
      'tax-rules',
      'ncm',
      'operation-natures',
    ],
  },
  {
    label: 'Financeiro',
    icon: 'wallet',
    sections: [
      'payables',
      'receivables',
      'chart-accounts',
      'receipts',
      'pix-collection',
      'digital-banks',
      'banks',
      'bank-movements',
    ],
  },
  {
    label: 'Ordem de Serviço',
    icon: 'tools',
    sections: [
      'service-orders',
      'services',
      'service-objects',
      'service-categories',
      'service-groups',
    ],
  },
  {
    label: 'Relatórios',
    icon: 'report',
    sections: ['reports-summary', 'reports-customers', 'reports-products'],
  },
  {
    label: 'Configurações',
    icon: 'settings',
    sections: [
      'settings',
      'company-registration',
      'branches',
      'users',
      'roles',
      'system-parameters',
      'subscription',
      'change-password',
      'switch-branch',
    ],
  },
];

export function AdminShell({
  user,
  onLogout,
  initialSection,
}: {
  user: CurrentUser;
  onLogout: () => Promise<void>;
  initialSection?: Section;
}) {
  const availableCandidates: Array<NavigationItem | false> = [
    user.modules.includes('catalog') &&
      user.permissions.includes('catalog.products.read') && {
        id: 'products' as const,
        label: 'Produtos',
      },
    user.modules.includes('sales') &&
      user.permissions.includes('sales.quotes.read') &&
      user.permissions.includes('sales.orders.read') && {
        id: 'sales-flow' as const,
        label: 'Pedidos de venda',
      },
    user.modules.includes('sales') &&
      user.permissions.includes('sales.quotes.manage') &&
      user.permissions.includes('sales.orders.read') && {
        id: 'sales-force' as const,
        label: 'Força de Vendas',
      },
    user.modules.includes('sales') &&
      user.permissions.includes('sales.pos.use') && {
        id: 'pos' as const,
        label: 'PDV',
      },
    user.modules.includes('finance') &&
      user.permissions.includes('finance.cash.read') && {
        id: 'cash' as const,
        label: 'Fechamento de caixa',
      },
    user.modules.includes('food') &&
      user.permissions.includes('food.tables.read') && {
        id: 'food' as const,
        label: 'Food Service',
      },
    user.modules.includes('logistics') &&
      user.permissions.includes('logistics.deliveries.read') && {
        id: 'delivery' as const,
        label: 'Delivery',
      },
    user.modules.includes('stock') &&
      user.permissions.includes('stock.inventory.read') && {
        id: 'stock' as const,
        label: 'Movimentação de estoque',
      },
    user.modules.includes('purchases') &&
      user.permissions.includes('purchases.suggestions.read') && {
        id: 'purchase-suggestions' as const,
        label: 'Sugestão de compras',
      },
    user.modules.includes('purchases') &&
      user.permissions.includes('purchases.quotations.read') && {
        id: 'quotations' as const,
        label: 'Cotações',
      },
    user.modules.includes('production') &&
      user.permissions.includes('production.orders.read') &&
      user.permissions.includes('production.engineering.read') && {
        id: 'production' as const,
        label: 'Ordens de produção',
      },
    (user.permissions.includes('sales.pos.use') ||
      user.permissions.includes('logistics.settings.manage') ||
      user.permissions.includes('integrations.whatsapp.read') ||
      user.permissions.includes('admin.branches.read')) && {
      id: 'settings' as const,
      label: 'Configurações',
    },
    user.modules.includes('purchases') &&
      user.permissions.includes('purchases.xml.read') && {
        id: 'purchase-xml' as const,
        label: 'Importar XML',
      },
    user.modules.includes('sales') &&
      user.permissions.includes('master.customers.read') && {
        id: 'customers' as const,
        label: 'Clientes',
      },
    user.modules.includes('purchases') &&
      user.permissions.includes('master.suppliers.read') && {
        id: 'suppliers' as const,
        label: 'Fornecedores',
      },
    user.modules.includes('core') &&
      user.permissions.includes('master.employees.read') && {
        id: 'employees' as const,
        label: 'Funcionários',
      },
    user.permissions.includes('admin.subscription.read') && {
      id: 'subscription' as const,
      label: 'Plano e módulos',
    },
    user.permissions.includes('admin.branches.read') && {
      id: 'branches' as const,
      label: 'Filiais',
    },
    user.permissions.includes('admin.users.read') && { id: 'users' as const, label: 'Usuários' },
    user.permissions.includes('admin.roles.read') && {
      id: 'roles' as const,
      label: 'Perfis e permissões',
    },
  ];
  if (user.modules.includes('sales'))
    availableCandidates.push(
      { id: 'returns', label: 'Troca de mercadoria' },
      { id: 'loyalty', label: 'Fidelidade' },
      { id: 'consignments', label: 'Consignação' },
      { id: 'pre-sales', label: 'Pré-venda' },
      { id: 'invoicing', label: 'Faturamento' },
      { id: 'commissions', label: 'Comissões' },
      { id: 'promotions', label: 'Promoções' },
      { id: 'pos-operations', label: 'Gerenciar operações' },
      { id: 'cash-tape', label: 'Fita de caixa' },
      { id: 'card-operators', label: 'Operadoras de cartões' },
      { id: 'payment-finalizers', label: 'Finalizadores de pagamento' },
    );
  if (user.modules.includes('purchases'))
    availableCandidates.push(
      { id: 'purchase-orders', label: 'Ordens de compra' },
      { id: 'purchase-analysis', label: 'Análise de compra' },
    );
  if (user.modules.includes('fiscal'))
    availableCandidates.push(
      { id: 'fiscal-documents', label: 'Documentos fiscais' },
      { id: 'fiscal-issuance', label: 'Emissão de nota fiscal' },
      { id: 'inbound-nfe', label: 'NF-e destinada' },
      { id: 'tax-rules', label: 'Regras de tributação ICMS' },
      { id: 'ncm', label: 'Cadastro de NCM' },
      { id: 'operation-natures', label: 'Natureza de operação' },
    );
  if (user.modules.includes('finance'))
    availableCandidates.push(
      { id: 'payables', label: 'Contas a pagar' },
      { id: 'receivables', label: 'Contas a receber' },
      { id: 'chart-accounts', label: 'Plano de contas' },
      { id: 'receipts', label: 'Gerar recibo' },
      { id: 'pix-collection', label: 'Cobrança PIX' },
      { id: 'digital-banks', label: 'Bancos digitais' },
      { id: 'banks', label: 'Bancos' },
      { id: 'bank-movements', label: 'Movimento bancário' },
    );
  if (user.modules.includes('core'))
    availableCandidates.push(
      { id: 'service-orders', label: 'Ordens de serviço' },
      { id: 'services', label: 'Cadastro de serviços' },
      { id: 'service-objects', label: 'Cadastro de objetos' },
      { id: 'service-categories', label: 'Categorias' },
      { id: 'service-groups', label: 'Grupos de serviços' },
      { id: 'reports-summary', label: 'Sumário geral' },
      { id: 'reports-customers', label: 'Clientes: compras e pagamentos' },
      { id: 'reports-products', label: 'Produtos: custo, venda e lucro' },
      { id: 'company-registration', label: 'Cadastro da empresa' },
      { id: 'system-parameters', label: 'Parâmetros do sistema' },
      { id: 'change-password', label: 'Alterar senha' },
      { id: 'switch-branch', label: 'Trocar filial' },
    );
  const available = availableCandidates.filter((item): item is NavigationItem => Boolean(item));
  const [section, setSection] = useState<Section>(
    available.some(({ id }) => id === initialSection)
      ? initialSection!
      : (available[0]?.id ?? 'branches'),
  );
  const groupedNavigation = navigationGroups
    .map((group) => ({
      ...group,
      items: group.sections
        .map((id) => available.find((item) => item.id === id))
        .filter((item): item is NavigationItem => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0);
  const activeMenu = groupedNavigation.find((group) =>
    group.items.some(({ id }) => id === section),
  )?.label;
  const [expandedMenu, setExpandedMenu] = useState<string | null>(activeMenu ?? null);
  const activeItem = available.find(({ id }) => id === section);
  useEffect(() => {
    if (activeMenu) setExpandedMenu(activeMenu);
  }, [activeMenu]);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">EH</div>
          <div className="sidebar-title">
            <strong>ERP Híbrido</strong>
            <span>Gestão empresarial</span>
          </div>
        </div>
        <nav aria-label="Módulos do sistema">
          {groupedNavigation.map((group) => (
            <section className="sidebar-menu" key={group.label}>
              <button
                type="button"
                className={`sidebar-menu-toggle ${activeMenu === group.label ? 'has-active' : ''}`}
                aria-expanded={expandedMenu === group.label}
                onClick={() =>
                  setExpandedMenu((current) => (current === group.label ? null : group.label))
                }
              >
                <span className="sidebar-menu-label">
                  <NavIcon name={group.icon} />
                  {group.label}
                </span>
                <span className="menu-chevron" aria-hidden="true">
                  {expandedMenu === group.label ? '⌃' : '⌄'}
                </span>
              </button>
              {expandedMenu === group.label && (
                <div className="sidebar-menu-items">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={section === item.id ? 'active' : ''}
                      aria-current={section === item.id ? 'page' : undefined}
                      onClick={() => setSection(item.id)}
                    >
                      <span>{item.label}</span>
                      <span className="menu-indicator" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </nav>
        <footer className="sidebar-footer">
          <span className="system-online">
            <i /> Sistema operacional
          </span>
          <small>PostgreSQL conectado · v0.1</small>
        </footer>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-context">
            <span className="context">{activeMenu ?? 'ERP HÍBRIDO'}</span>
            <strong>{activeItem?.label ?? 'Visão geral'}</strong>
          </div>
          <div className="topbar-actions">
            <span className="branch-chip">
              <i /> Matriz · Loja Centro
            </span>
            <div className="user-chip" aria-label={`Usuário conectado: ${user.displayName}`}>
              <span>{initials(user.displayName)}</span>
              <div>
                <strong>{user.displayName}</strong>
                <small>Administrador</small>
              </div>
            </div>
            <button className="quiet topbar-logout" onClick={() => void onLogout()}>
              Sair
            </button>
          </div>
        </header>
        <main className="content">
          {isWorkspaceSection(section) && <ModuleWorkspacePanel section={section} />}
          {available.length === 0 && (
            <section className="empty">
              <h1>Sem módulos liberados</h1>
              <p>Nenhum menu foi liberado para este perfil.</p>
            </section>
          )}
          {section === 'products' && (
            <ProductsPanel
              canManage={
                user.permissions.includes('catalog.products.manage') &&
                user.permissions.includes('catalog.price.manage')
              }
              canReadCost={user.permissions.includes('catalog.cost.read')}
            />
          )}
          {section === 'sales-flow' && (
            <SalesPanel
              canManage={
                user.permissions.includes('sales.quotes.manage') &&
                user.permissions.includes('sales.orders.manage')
              }
              canDiscount={user.permissions.includes('sales.discounts.apply')}
            />
          )}
          {section === 'sales-force' && (
            <SalesForceApp
              canCreateCustomer={user.permissions.includes('master.customers.manage')}
              canInvoice={
                user.modules.includes('fiscal') && user.permissions.includes('fiscal.nfe.issue')
              }
              offlineScope={`${user.companyId}:${user.branchId}:${user.id}`}
            />
          )}
          {section === 'pos' && (
            <PosPanel
              canDiscount={user.permissions.includes('sales.pos.discount')}
              canReadCredit={user.permissions.includes('sales.credit.read')}
              canReceiveCredit={user.permissions.includes('sales.credit.receive')}
              offlineScope={`${user.companyId}:${user.branchId}`}
              onOpenSettings={() => setSection('settings')}
            />
          )}
          {section === 'cash' && (
            <CashPanel
              canOperate={user.permissions.includes('finance.cash.operate')}
              canReopen={user.permissions.includes('finance.cash.reopen')}
            />
          )}
          {section === 'card-operators' && (
            <PaymentConfigurationPanel
              mode="operators"
              canManage={user.permissions.includes('finance.cash.operate')}
            />
          )}
          {section === 'payment-finalizers' && (
            <PaymentConfigurationPanel
              mode="methods"
              canManage={user.permissions.includes('finance.cash.operate')}
            />
          )}
          {section === 'pos-operations' && <CashOperationsPanel mode="operations" />}
          {section === 'cash-tape' && <CashOperationsPanel mode="tape" />}
          {section === 'food' && (
            <FoodServicePanel
              canManage={user.permissions.includes('food.tables.manage')}
              canOperate={user.permissions.includes('food.tabs.operate')}
            />
          )}
          {section === 'delivery' && (
            <DeliveryPanel canOperate={user.permissions.includes('logistics.deliveries.operate')} />
          )}
          {section === 'settings' && (
            <SystemSettingsPanel
              canManagePos={user.permissions.includes('sales.pos.settings.manage')}
              canReadDelivery={user.permissions.includes('logistics.deliveries.read')}
              canManageDelivery={user.permissions.includes('logistics.settings.manage')}
              canReadWhatsapp={
                user.modules.includes('integrations') &&
                user.permissions.includes('integrations.whatsapp.read')
              }
              canManageWhatsapp={user.permissions.includes('integrations.whatsapp.manage')}
              canSendWhatsapp={user.permissions.includes('integrations.whatsapp.send')}
              destinations={(['subscription', 'branches', 'users', 'roles'] as const).filter(
                (destination) => available.some(({ id }) => id === destination),
              )}
              onNavigate={setSection}
            />
          )}
          {section === 'stock' && (
            <StockPanel
              canAdjust={user.permissions.includes('stock.adjustments.create')}
              canReadMovements={user.permissions.includes('stock.movements.read')}
            />
          )}
          {section === 'purchase-xml' && (
            <PurchaseXmlPanel canImport={user.permissions.includes('purchases.xml.import')} />
          )}
          {section === 'purchase-suggestions' && (
            <PurchaseSuggestionPanel
              canCalculate={user.permissions.includes('purchases.suggestions.calculate')}
            />
          )}
          {section === 'quotations' && (
            <QuotationPanel
              canManage={user.permissions.includes('purchases.quotations.manage')}
              canSendWhatsapp={
                user.modules.includes('integrations') &&
                user.permissions.includes('integrations.whatsapp.send')
              }
            />
          )}
          {section === 'whatsapp' && (
            <WhatsappIntegrationPanel
              canManage={user.permissions.includes('integrations.whatsapp.manage')}
              canSend={user.permissions.includes('integrations.whatsapp.send')}
            />
          )}
          {section === 'production' && (
            <ProductionPanel
              canEngineer={user.permissions.includes('production.engineering.manage')}
              canManage={user.permissions.includes('production.orders.manage')}
              canFinalize={user.permissions.includes('production.orders.finalize')}
            />
          )}
          {section === 'customers' && (
            <CustomersPanel canManage={user.permissions.includes('master.customers.manage')} />
          )}
          {section === 'suppliers' && (
            <SuppliersPanel canManage={user.permissions.includes('master.suppliers.manage')} />
          )}
          {section === 'employees' && (
            <EmployeesPanel canManage={user.permissions.includes('master.employees.manage')} />
          )}
          {section === 'subscription' && <SubscriptionPanel />}
          {section === 'branches' && available.some(({ id }) => id === 'branches') && (
            <BranchesPanel canManage={user.permissions.includes('admin.branches.manage')} />
          )}
          {section === 'users' && (
            <UsersPanel canManage={user.permissions.includes('admin.users.manage')} />
          )}
          {section === 'roles' && (
            <RolesPanel canManage={user.permissions.includes('admin.roles.manage')} />
          )}
        </main>
      </div>
    </div>
  );
}

type NavIconName =
  | 'people'
  | 'box'
  | 'cart'
  | 'chart'
  | 'register'
  | 'document'
  | 'wallet'
  | 'tools'
  | 'report'
  | 'settings';

function NavIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, React.ReactNode> = {
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M16 5.5a3 3 0 0 1 0 5.5M16 13c2.7.3 4.2 2.3 4.5 5" />
      </>
    ),
    box: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7M12 11v10" />
      </>
    ),
    cart: (
      <>
        <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    register: (
      <>
        <rect x="3" y="6" width="18" height="14" rx="2" />
        <path d="M7 6V3h10v3M7 11h10M8 15h2M14 15h2" />
      </>
    ),
    document: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 12h6M9 16h6" />
      </>
    ),
    wallet: (
      <>
        <path d="M3 6h16a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6Z" />
        <path d="M3 6 16 3v3M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z" />
      </>
    ),
    tools: (
      <>
        <path d="m14 6 4-4 4 4-4 4M3 21l9-9M6 3l15 15-3 3L3 6z" />
      </>
    ),
    report: (
      <>
        <path d="M5 21V3h14v18zM9 17v-4M13 17V8M17 17v-6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
  };
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
