export type WorkspaceSection =
  | 'returns'
  | 'loyalty'
  | 'purchase-orders'
  | 'purchase-analysis'
  | 'consignments'
  | 'pre-sales'
  | 'invoicing'
  | 'commissions'
  | 'promotions'
  | 'pos-operations'
  | 'cash-tape'
  | 'fiscal-documents'
  | 'fiscal-issuance'
  | 'inbound-nfe'
  | 'tax-rules'
  | 'ncm'
  | 'operation-natures'
  | 'payables'
  | 'receivables'
  | 'chart-accounts'
  | 'receipts'
  | 'pix-collection'
  | 'digital-banks'
  | 'banks'
  | 'bank-movements'
  | 'service-orders'
  | 'services'
  | 'service-objects'
  | 'service-categories'
  | 'service-groups'
  | 'reports-summary'
  | 'reports-customers'
  | 'reports-products'
  | 'company-registration'
  | 'system-parameters'
  | 'change-password'
  | 'switch-branch';

const modules: Record<
  WorkspaceSection,
  { title: string; description: string; features: string[] }
> = {
  returns: {
    title: 'Troca de mercadoria',
    description: 'Recebimento, motivo, conferência e crédito ou substituição.',
    features: [
      'Vincular venda original',
      'Entrada rastreável no estoque',
      'Crédito ou nova mercadoria',
    ],
  },
  loyalty: {
    title: 'Fidelidade',
    description: 'Regras de pontos e benefícios para clientes recorrentes.',
    features: ['Pontuação por compra', 'Validade dos pontos', 'Resgate e extrato'],
  },
  'purchase-orders': {
    title: 'Ordens de compra',
    description: 'Pedidos enviados a fornecedores e acompanhamento de recebimento.',
    features: ['Gerar pela cotação', 'Aprovação e envio', 'Recebimento parcial'],
  },
  'purchase-analysis': {
    title: 'Análise de compra',
    description: 'Sugestões de reposição combinando giro, saldo, pedidos e prazo.',
    features: ['Cobertura de estoque', 'Curva de consumo', 'Reposição recomendada'],
  },
  consignments: {
    title: 'Consignação',
    description: 'Mercadorias entregues com acerto posterior.',
    features: ['Remessa consignada', 'Saldo em poder do cliente', 'Acerto e devolução'],
  },
  'pre-sales': {
    title: 'Pré-venda',
    description: 'Reserva comercial antes do pagamento no caixa.',
    features: ['Reserva de itens', 'Conversão no PDV', 'Validade da pré-venda'],
  },
  invoicing: {
    title: 'Faturamento',
    description: 'Fila de pedidos liberados para faturar e expedir.',
    features: ['Conferência comercial', 'Emissão fiscal', 'Liberação de entrega'],
  },
  commissions: {
    title: 'Comissões',
    description: 'Regras e apuração por vendedor, produto e recebimento.',
    features: ['Faixas de comissão', 'Apuração por período', 'Estorno por devolução'],
  },
  promotions: {
    title: 'Promoções',
    description: 'Campanhas por produto, quantidade, cliente e período.',
    features: ['Preço promocional', 'Leve e pague', 'Regras cumulativas'],
  },
  'pos-operations': {
    title: 'Gerenciar operações do PDV',
    description: 'Consulta central de todas as vendas realizadas no caixa.',
    features: ['Venda e operador', 'Situação fiscal', 'Cancelamento autorizado'],
  },
  'cash-tape': {
    title: 'Fita de caixa',
    description: 'Linha cronológica de vendas, recebimentos, sangrias e suprimentos.',
    features: ['Todas as vendas', 'Eventos por operador', 'Auditoria por data e hora'],
  },
  'fiscal-documents': {
    title: 'Documentos fiscais',
    description: 'Consulta unificada de NF-e, NFC-e e eventos fiscais.',
    features: ['Autorizados e rejeitados', 'Cancelamentos', 'XML e DANFE'],
  },
  'fiscal-issuance': {
    title: 'Emissão de nota fiscal',
    description: 'Emissão de NF-e e NFC-e a partir das operações comerciais.',
    features: ['NF-e modelo 55', 'NFC-e modelo 65', 'Carta de correção e cancelamento'],
  },
  'inbound-nfe': {
    title: 'NF-e destinada',
    description: 'Documentos emitidos contra a empresa e manifestação do destinatário.',
    features: ['Consulta de NSU', 'Manifestação', 'Download de XML'],
  },
  'tax-rules': {
    title: 'Regras de tributação ICMS',
    description: 'Determinação fiscal por produto, operação, origem e destino.',
    features: ['ICMS e DIFAL', 'PIS/COFINS/IPI', 'Prioridade de regras'],
  },
  ncm: {
    title: 'Cadastro de NCM',
    description: 'Classificação fiscal e parâmetros vinculados aos produtos.',
    features: ['NCM e descrição', 'CEST', 'Vigência'],
  },
  'operation-natures': {
    title: 'Naturezas de operação',
    description: 'CFOP, finalidade e comportamento fiscal das operações.',
    features: ['Entrada e saída', 'Dentro e fora do estado', 'Texto complementar'],
  },
  payables: {
    title: 'Contas a pagar',
    description: 'Títulos, parcelas, aprovações e baixas de fornecedores.',
    features: ['Agenda de vencimentos', 'Pagamento parcial', 'Juros e descontos'],
  },
  receivables: {
    title: 'Contas a receber',
    description: 'Recebíveis de vendas, crediário e cobranças.',
    features: ['Parcelas em aberto', 'Baixa parcial', 'Inadimplência'],
  },
  'chart-accounts': {
    title: 'Plano de contas',
    description: 'Estrutura financeira gerencial para receitas e despesas.',
    features: ['Hierarquia de contas', 'Centros de custo', 'DRE gerencial'],
  },
  receipts: {
    title: 'Gerar recibo',
    description: 'Recibos numerados vinculados a recebimentos confirmados.',
    features: ['Pagador e favorecido', 'Valor por extenso', 'Impressão e PDF'],
  },
  'pix-collection': {
    title: 'Cobrança PIX',
    description: 'Cobranças imediatas e com vencimento integradas a bancos.',
    features: ['QR Code dinâmico', 'Webhook de liquidação', 'Conciliação automática'],
  },
  'digital-banks': {
    title: 'Bancos digitais',
    description: 'Conectores para cobrança, extrato e conciliação via API.',
    features: ['Credenciais seguras', 'Cobrança PIX', 'Extrato automático'],
  },
  banks: {
    title: 'Bancos e contas',
    description: 'Cadastro de instituições, agências, contas e carteiras.',
    features: ['Conta corrente e caixa', 'Saldo inicial', 'Responsáveis'],
  },
  'bank-movements': {
    title: 'Movimento bancário',
    description: 'Entradas, saídas, transferências e conciliação.',
    features: ['Extrato por período', 'Conciliação', 'Transferência entre contas'],
  },
  'service-orders': {
    title: 'Ordens de serviço',
    description: 'Abertura, orçamento, execução e faturamento de serviços.',
    features: ['Cliente e objeto', 'Peças e serviços', 'Status e técnico'],
  },
  services: {
    title: 'Cadastro de serviços',
    description: 'Catálogo de mão de obra, preço e duração estimada.',
    features: ['Código e descrição', 'Preço e custo', 'Tributação de serviço'],
  },
  'service-objects': {
    title: 'Objetos de serviço',
    description: 'Equipamentos, veículos ou bens atendidos por cliente.',
    features: ['Marca e modelo', 'Número de série/placa', 'Histórico de atendimento'],
  },
  'service-categories': {
    title: 'Categorias de serviço',
    description: 'Classificação operacional dos atendimentos.',
    features: ['Categoria', 'Prioridade', 'SLA padrão'],
  },
  'service-groups': {
    title: 'Grupos de serviços',
    description: 'Agrupamento comercial e técnico do catálogo.',
    features: ['Grupo e subgrupo', 'Equipe responsável', 'Centro de custo'],
  },
  'reports-summary': {
    title: 'Sumário geral',
    description: 'Indicadores consolidados de vendas, caixa, estoque e financeiro.',
    features: ['Faturamento e margem', 'Saldo e giro', 'Contas e caixa'],
  },
  'reports-customers': {
    title: 'Relatório de clientes',
    description: 'Cadastro, compras, cupons, pagamentos e saldo por cliente.',
    features: ['Histórico de compras', 'Histórico de pagamentos', 'Saldo e frequência'],
  },
  'reports-products': {
    title: 'Relatório de produtos',
    description: 'Custo, preço de venda, lucro unitário e margem.',
    features: ['Preço de custo e venda', 'Lucro e margem', 'Filtros por grupo e status'],
  },
  'company-registration': {
    title: 'Cadastro da empresa',
    description: 'Dados legais, fiscais, contatos e identidade da empresa.',
    features: ['CNPJ e inscrições', 'Endereço e contatos', 'Logotipo e documentos'],
  },
  'system-parameters': {
    title: 'Parâmetros do sistema',
    description: 'Numeração, comportamento padrão e regras gerais por filial.',
    features: ['Séries e sequências', 'Padrões operacionais', 'Segurança e auditoria'],
  },
  'change-password': {
    title: 'Alterar senha',
    description: 'Atualização segura da senha do usuário conectado.',
    features: ['Senha atual', 'Nova senha forte', 'Encerrar outras sessões'],
  },
  'switch-branch': {
    title: 'Trocar filial',
    description: 'Alternância de contexto entre filiais autorizadas.',
    features: ['Filiais permitidas', 'Contexto de estoque', 'Contexto fiscal e financeiro'],
  },
};

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return value in modules;
}

export function ModuleWorkspacePanel({ section }: { section: WorkspaceSection }) {
  const module = modules[section];
  return (
    <section className="module-workspace">
      <header>
        <span className="eyebrow">MÓDULO ERP</span>
        <h1>{module.title}</h1>
        <p>{module.description}</p>
      </header>
      <div className="module-workspace-grid">
        {module.features.map((feature, index) => (
          <article key={feature}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{feature}</strong>
            <small>Fluxo preparado na arquitetura modular</small>
          </article>
        ))}
      </div>
      <div className="module-workspace-state">
        <strong>Estrutura visual criada</strong>
        <p>
          Este submenu já integra a nova navegação. Regras transacionais, banco e permissões serão
          evoluídos no fluxo normal do projeto.
        </p>
      </div>
    </section>
  );
}
