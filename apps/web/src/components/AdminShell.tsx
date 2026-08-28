import { useState } from 'react';
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
  | 'roles';

type NavigationItem = { id: Section; label: string };

const navigationGroups: Array<{
  label: string;
  sections: Section[];
}> = [
  {
    label: 'Operação',
    sections: ['sales-flow', 'sales-force', 'pos', 'cash', 'food', 'delivery'],
  },
  {
    label: 'Cadastros',
    sections: ['products', 'customers', 'suppliers', 'employees'],
  },
  {
    label: 'Estoque e compras',
    sections: ['stock', 'purchase-suggestions', 'quotations', 'purchase-xml'],
  },
  {
    label: 'Produção',
    sections: ['production'],
  },
  {
    label: 'Administração',
    sections: ['settings', 'subscription', 'branches', 'users', 'roles'],
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
        label: 'Vendas',
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
        label: 'Caixa',
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
        label: 'Estoque',
      },
    user.modules.includes('purchases') &&
      user.permissions.includes('purchases.suggestions.read') && {
        id: 'purchase-suggestions' as const,
        label: 'Sugestão de compra',
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
        label: 'Produção',
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

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="logo">EH</div>
        <div className="sidebar-title">
          <strong>ERP Híbrido</strong>
          <span>Gestão empresarial</span>
        </div>
        <nav aria-label="Módulos do sistema">
          {groupedNavigation.map((group) => (
            <section className="sidebar-menu" key={group.label}>
              <h2>{group.label}</h2>
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
            </section>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="context">EMPRESA · FILIAL</span>
            <strong>{user.displayName}</strong>
          </div>
          <button className="quiet" onClick={() => void onLogout()}>
            Sair
          </button>
        </header>
        <main className="content">
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
          {section === 'food' && (
            <FoodServicePanel
              canManage={user.permissions.includes('food.tables.manage')}
              canOperate={user.permissions.includes('food.tabs.operate')}
            />
          )}
          {section === 'delivery' && (
            <DeliveryPanel
              canOperate={user.permissions.includes('logistics.deliveries.operate')}
            />
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
