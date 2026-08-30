export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  services: { database: boolean; redis: boolean };
}

export interface ApiErrorResponse {
  status: number;
  code: string;
  message: string;
  correlationId: string;
  details?: unknown;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  companyId: string;
  branchId: string;
  permissions: string[];
  modules: string[];
}

export interface BranchSummary {
  id: string;
  code: string;
  legalName: string;
  tradeName: string | null;
  taxId: string;
  status: string;
}

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  permissionIds: string[];
}

export interface AdminUserSummary {
  id: string;
  status: string;
  user?: { id: string; email: string; displayName: string; status: string };
  branchIds: string[];
  roleIds: string[];
}

export interface SubscriptionSummary {
  id: string;
  status: 'trial' | 'active' | 'past_due' | 'blocked' | 'canceled';
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  blockedAt: string | null;
  plan: { code: string; name: string; price: string; billingPeriod: string };
  usage: { users: { used: number; limit: number }; branches: { used: number; limit: number } };
  modules: Array<{ code: string; name: string }>;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface CustomerSummary {
  id: string;
  personType: 'F' | 'J';
  taxId: string | null;
  legalName: string;
  tradeName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  creditLimit: string;
  active: boolean;
}
export interface SupplierSummary {
  id: string;
  taxId: string | null;
  legalName: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  averageLeadDays: number | null;
  paymentTerms: string | null;
  active: boolean;
}
export interface SupplierCatalogProduct {
  id: string;
  code: string;
  description: string;
}
export interface SupplierProductLink {
  id: string;
  supplierId: string;
  productId: string;
  supplierCode: string | null;
  supplierDescription: string | null;
  lastPrice: string | null;
  product?: SupplierCatalogProduct & { active: boolean };
}
export interface SupplierPriceComparison {
  product: SupplierCatalogProduct;
  offers: Array<{
    supplier: {
      id: string;
      legalName: string;
      tradeName: string | null;
      averageLeadDays: number | null;
      active: boolean;
    };
    supplierCode: string | null;
    supplierDescription: string | null;
    lastPrice: string | null;
    hasRecordedPrice: boolean;
  }>;
  bestRecordedPrice: string | null;
  note: string;
}
export interface EmployeeSummary {
  id: string;
  branchId: string | null;
  userId: string | null;
  code: string;
  name: string;
  taxId: string | null;
  jobTitle: string | null;
  active: boolean;
}
export interface CatalogLookup {
  id: string;
  code?: string;
  name?: string;
  legalName?: string;
}
export interface CatalogLookups {
  groups: CatalogLookup[];
  categories: Array<CatalogLookup & { parentId?: string | null }>;
  brands: CatalogLookup[];
  units: CatalogLookup[];
  priceTables: CatalogLookup[];
  branches: CatalogLookup[];
}
export interface ProductSummary {
  id: string;
  code: string;
  barcode: string | null;
  description: string;
  shortDescription: string | null;
  unitId: string;
  active: boolean;
  controlsLot: boolean;
  controlsExpiry: boolean;
  price: null | { salePrice: string; minimumPrice: string | null; cost?: string };
}
export interface BarcodeSuggestion {
  barcode: string;
  found: boolean;
  provider: 'openfoodfacts';
  confidence: 'community' | 'none';
  fields: null | {
    description: string | null;
    shortDescription: string | null;
    brandName: string | null;
    imageUrl: string | null;
    quantityLabel: string | null;
    ncm: null;
  };
  sourceUrl: string | null;
  warnings: string[];
}
export interface AddressSuggestion {
  postalCode: string | null;
  street: string | null;
  number?: string | null;
  complement?: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country?: 'BR';
}
export interface CnpjSuggestion {
  cnpj: string;
  found: boolean;
  provider: 'brasilapi';
  fields: null | {
    legalName: string | null;
    tradeName: string | null;
    phone: string | null;
    email: string | null;
    registrationStatus: string | null;
    address: AddressSuggestion | null;
  };
  sourceUrl: string | null;
  warnings: string[];
}
export interface CepSuggestion {
  cep: string;
  found: boolean;
  provider: 'brasilapi';
  fields: AddressSuggestion | null;
  sourceUrl: string | null;
  warnings: string[];
}
export interface StockOverviewItem {
  id: string;
  code: string;
  description: string;
  controlsLot: boolean;
  controlsExpiry: boolean;
  quantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  minimumStock: string;
  status: 'ok' | 'low' | 'out';
}
export interface StockOverview {
  items: StockOverviewItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: { out: number; low: number; ok: number };
}
export interface StockLookups {
  warehouses: Array<{ id: string; code: string; name: string }>;
  locations: Array<{ id: string; warehouseId: string; code: string; name: string }>;
  products: Array<{
    id: string;
    code: string;
    description: string;
    controlsLot: boolean;
    controlsExpiry: boolean;
  }>;
  lots: Array<{
    id: string;
    productId: string;
    lotNumber: string;
    manufacturedAt: string | null;
    expiresAt: string | null;
  }>;
}
export interface StockMovementSummary {
  id: string;
  productId: string;
  movementType: string;
  quantity: string;
  occurredAt: string;
  product?: { id: string; code: string; description: string };
  location?: { id: string; code: string; name: string };
  lot: null | { id: string; lotNumber: string; expiresAt: string | null };
  actor?: { id: string; displayName: string };
}
export interface StockLotOverviewItem {
  id: string;
  productId: string;
  lotNumber: string;
  manufacturedAt: string | null;
  expiresAt: string | null;
  productCode: string;
  productDescription: string;
  quantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  status: 'expired' | '15' | '30' | '60' | '90' | 'valid' | 'none';
}
export interface StockLotOverview {
  items: StockLotOverviewItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    expired: number;
    within15: number;
    within30: number;
    within60: number;
    within90: number;
  };
}
export interface FefoPreview {
  product: { id: string; code: string; description: string };
  requestedQuantity: string;
  allocations: Array<{
    lotId: string;
    lotNumber: string;
    expiresAt: string | null;
    quantity: string;
  }>;
  shortageQuantity: string;
  fulfilled: boolean;
  warning: string;
}
export interface PurchaseImportJob {
  id: string;
  status: 'needs_mapping' | 'ready' | 'confirmed';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  confirmedAt: string | null;
  createdAt: string;
}
export interface PurchaseImportRow {
  id: string;
  rowNumber: number;
  normalizedData: null | {
    supplierTaxId: string;
    supplierCode: string;
    description: string;
    ncm: string | null;
    cfop: string | null;
    quantity: string;
    unitPrice: string;
    total: string;
    productId: string | null;
    traces: Array<{
      lotNumber: string;
      quantity: string;
      manufacturedAt: string | null;
      expiresAt: string | null;
    }>;
  };
  errors: string[];
}
export interface PurchaseImportDetail extends PurchaseImportJob {
  rows: PurchaseImportRow[];
}
export interface PurchaseSuggestionSummary {
  id: string;
  forecastDays: number;
  status: 'calculated' | 'quoted';
  calculatedAt: string;
  itemCount: number;
  totalSuggestedItems: number;
}
export interface PurchaseSuggestionItem {
  id: string;
  productId: string;
  product: { code: string; description: string };
  averageDailySales: string;
  availableStock: string;
  safetyStock: string;
  pendingPurchase: string;
  suggestedQuantity: string;
  explanation: {
    forecastDemand: string;
    leadTimeDemand: string;
    inTransitPurchase: string;
    minimumStock: string;
    maximumStock: string | null;
    targetStock: string;
    daysOfCoverage: string | null;
    leadDays: number;
    trendFactor: number;
    seasonalityFactor: number;
    demandFactor: number;
    reason: string;
  };
}
export interface PurchaseSuggestionDetail extends PurchaseSuggestionSummary {
  parameters: { historyDays: number; recentDays: number; calculationVersion: string };
  items: PurchaseSuggestionItem[];
}
export interface QuotationSummary {
  id: string;
  number: string;
  status: 'open' | 'closed' | 'expired';
  responseDeadline: string;
  createdAt: string;
  supplierCount: number;
  responseCount: number;
  itemCount: number;
}
export interface QuotationOffer {
  quotationSupplierId: string;
  supplier: { id: string; legalName: string; tradeName: string | null };
  brand: string | null;
  offeredQuantity: string;
  unitPrice: string;
  leadDays: number | null;
  paymentTerms: string | null;
  paymentTermDays: number | null;
  notes: string | null;
  lastPrice: string | null;
  priceChange: string | null;
  isLowestPrice: boolean;
  isShortestLead: boolean;
  isBestPaymentTerm: boolean;
}
export interface QuotationComparisonItem {
  id: string;
  productId: string;
  product: { code: string; description: string };
  quantity: string;
  offers: QuotationOffer[];
  lowestPrice: string | null;
  potentialSavings: string;
}
export interface QuotationDetail extends QuotationSummary {
  purchaseSuggestionId: string | null;
  items: QuotationComparisonItem[];
  suppliers: Array<{
    id: string;
    supplierId: string;
    supplier: { legalName: string; tradeName: string | null; phone: string | null };
    status: string;
    sentAt: string | null;
    respondedAt: string | null;
  }>;
  totalPotentialSavings: string;
  invitations?: Array<{ quotationSupplierId: string; supplierId: string; publicPath: string }>;
}
export interface PublicQuotation {
  number: string;
  companyName: string;
  supplierName: string;
  responseDeadline: string;
  expired: boolean;
  submitted: boolean;
  items: Array<{
    id: string;
    product: { code: string; description: string };
    quantity: string;
    response: null | {
      brand: string | null;
      offeredQuantity: string;
      unitPrice: string;
      leadDays: number | null;
      paymentTerms: string | null;
      paymentTermDays: number | null;
      notes: string | null;
    };
  }>;
}
export interface WhatsappIntegrationConfig {
  id: string;
  status: 'active' | 'inactive';
  provider: 'evolution';
  baseUrl: string;
  instanceName: string;
  sendTextPath: string;
  apiKeyEnvKey: string;
  webhookSecretEnvKey: string;
  webhookPath: string;
}
export interface WhatsappMessageSummary {
  id: string;
  direction: 'outbound' | 'inbound';
  recipient: string;
  messageType: 'text';
  providerMessageId: string | null;
  status: 'created' | 'sent' | 'delivered' | 'read' | 'responded' | 'error' | 'failed';
  attempts: number;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  respondedAt: string | null;
  createdAt: string;
}
export type ProductionStatus = 'planned' | 'separation' | 'processing' | 'quality' | 'finalized';
export interface ProductionLookupItem {
  id: string;
  code: string;
  description: string;
  controlsLot: boolean;
  controlsExpiry: boolean;
  unitId: string;
}
export interface BomSummary {
  id: string;
  productId: string;
  product: { code: string; description: string };
  version: number;
  yieldQuantity: string;
  expectedLossPercent: string;
  active: boolean;
  items: Array<{
    id: string;
    componentProductId: string;
    component: { code: string; description: string };
    unitId: string;
    quantity: string;
    lossPercent: string;
  }>;
}
export interface ProductionOrderSummary {
  id: string;
  number: string;
  status: ProductionStatus;
  productId: string;
  product: { code: string; description: string };
  bomId: string;
  plannedQuantity: string;
  producedQuantity: string;
  plannedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  qualityNotes: string | null;
  createdAt: string;
}
export interface ProductionOrderDetail extends ProductionOrderSummary {
  bom: BomSummary;
  requirements: Array<{
    productId: string;
    product: { code: string; description: string; controlsLot: boolean };
    expectedQuantity: string;
    expectedLossQuantity: string;
    availableQuantity: string;
    sufficient: boolean;
  }>;
  consumptions: Array<{
    id: string;
    productId: string;
    lotId: string | null;
    quantity: string;
    lossQuantity: string;
  }>;
  outputs: Array<{
    id: string;
    lotId: string;
    lotNumber: string;
    quantity: string;
  }>;
}
export type SalesQuoteStatus = 'draft' | 'sent' | 'approved' | 'converted' | 'expired' | 'canceled';
export type SalesOrderStatus =
  'pending' | 'separation' | 'invoicing' | 'delivery' | 'completed' | 'canceled';
export interface SalesQuoteSummary {
  id: string;
  number: string;
  status: SalesQuoteStatus;
  customer: { id: string; name: string } | null;
  seller: { id: string; name: string };
  paymentMethod: { id: string; name: string };
  validUntil: string | null;
  subtotal: string;
  discount: string;
  surcharge: string;
  freight: string;
  total: string;
  notes: string | null;
  itemCount: number;
  createdAt: string;
}
export interface SalesOrderSummary {
  id: string;
  number: string;
  status: SalesOrderStatus;
  origin: string;
  customer: { id: string; name: string } | null;
  seller: { id: string; name: string };
  paymentMethod: { id: string; name: string };
  subtotal: string;
  discount: string;
  surcharge: string;
  freight: string;
  total: string;
  notes: string | null;
  items: Array<{
    id: string;
    productId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    total: string;
    locationId: string | null;
    lotId: string | null;
    controlsLot: boolean;
  }>;
  createdAt: string;
}
export interface PosProduct {
  id: string;
  code: string;
  barcode: string | null;
  description: string;
  unitCode: string;
  openPrice: boolean;
  controlsLot: boolean;
  controlsExpiry: boolean;
  selectLotAtPos: boolean;
  lots: Array<{
    id: string;
    lotNumber: string;
    expiresAt: string | null;
    availableQuantity: string;
  }>;
  salePrice: string | null;
  availableQuantity: string;
}
export interface PosCheckoutResult {
  orderId: string;
  orderNumber: string;
  saleId: string;
  saleNumber: string;
  total: string;
  itemCount: number;
  paymentCount: number;
  soldAt: string;
  issuer: {
    tradeName: string | null;
    legalName: string;
    taxId: string;
  };
  offlinePending?: boolean;
}
export interface CashSessionSummary {
  id: string;
  register: { id: string; code: string; name: string };
  operatorId: string;
  status: 'open' | 'closed';
  openingAmount: string;
  openedAt: string;
  closedAt: string | null;
  totals: Array<{ paymentMethodId: string | null; methodName: string; amount: string }>;
  movements: Array<{
    id: string;
    type: 'opening' | 'receipt' | 'payment' | 'supply' | 'withdrawal';
    amount: string;
    description: string;
    occurredAt: string;
  }>;
}
export interface CustomerCreditStatement {
  customer: { id: string; name: string; creditLimit: string };
  period: { from: string; to: string };
  totalPurchased: string;
  totalPaid: string;
  totalDue: string;
  coupons: Array<{
    saleId: string;
    saleNumber: string;
    soldAt: string;
    total: string;
    creditAmount: string;
    amountPaid: string;
    amountDue: string;
    receivableId: string | null;
    items: Array<{ description: string; quantity: string; unitPrice: string; total: string }>;
  }>;
}
