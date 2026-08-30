import { useEffect, useMemo, useRef, useState } from 'react';
import type { PosCheckoutResult, PosProduct } from '@erp/contracts';
import { apiRequest } from '../api';
import { CustomerStatementPanel } from './CustomerStatementPanel';
import { PosSettingsDialog } from './PosSettingsDialog';
import { SaleCompletionDialog, type SaleReceipt } from './SaleCompletionDialog';
import {
  cachePosLookups,
  enqueueCheckout,
  isNetworkFailure,
  pendingCheckoutCount,
  readPosLookups,
  synchronizeCheckouts,
} from '../offline-pos';

type Lookup = {
  issuer: PosCheckoutResult['issuer'];
  customers: Array<{ id: string; name: string }>;
  sellers: Array<{ id: string; name: string }>;
  paymentMethods: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    maxInstallments?: number;
    cardConfiguration?: {
      operatorName: string;
      debitRate: string;
      creditRate: string;
      installmentRate: string;
      settlementDays: number;
    } | null;
  }>;
  locations: Array<{ id: string; code: string; name: string }>;
  products: PosProduct[];
  settings?: {
    defaultCustomerId: string | null;
    defaultSellerId: string | null;
    defaultLocationId: string | null;
    sellerMode: 'default' | 'per_sale';
  };
};
type CartItem = PosProduct & {
  quantity: number;
  unitPrice: number;
  discount: number;
  lotId: string | null;
  lotNumber: string | null;
  lotExpiresAt: string | null;
};
type PaymentDraft = { key: number; paymentMethodId: string; amount: string; installments: number };
type PosDestination =
  'customers' | 'cash' | 'pos-operations' | 'cash-tape' | 'pre-sales' | 'returns' | 'loyalty';
type HeldSale = {
  id: string;
  createdAt: string;
  cart: CartItem[];
  payments: PaymentDraft[];
  customerId: string;
  sellerId: string;
  surcharge?: number;
  freight?: number;
};
type CashOverview = {
  registers: Array<{ id: string; code: string; name: string }>;
  sessions: Array<{ id: string; status: string; register: { name: string } }>;
};

export function PosPanel({
  canDiscount,
  canReadCredit = false,
  canReceiveCredit = false,
  offlineScope = 'default',
  onOpenSettings,
  onNavigate,
  onExit,
  requireCashOpening = false,
}: {
  canDiscount: boolean;
  canReadCredit?: boolean;
  canReceiveCredit?: boolean;
  offlineScope?: string;
  onOpenSettings?: () => void;
  onNavigate?: (destination: PosDestination) => void;
  onExit?: () => void;
  requireCashOpening?: boolean;
}) {
  const [lookup, setLookup] = useState<Lookup>({
    issuer: { tradeName: null, legalName: '', taxId: '' },
    customers: [],
    sellers: [],
    paymentMethods: [],
    locations: [],
    products: [],
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [entryQuantity, setEntryQuantity] = useState(1);
  const [productListOpen, setProductListOpen] = useState(false);
  const [productListQuery, setProductListQuery] = useState('');
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentDraft[]>([
    { key: 1, paymentMethodId: '', amount: '0.00', installments: 1 },
  ]);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [statementOpen, setStatementOpen] = useState(false);
  const [lotSelection, setLotSelection] = useState<PosProduct | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [heldSalesOpen, setHeldSalesOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [sellerPickerOpen, setSellerPickerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [saleNotes, setSaleNotes] = useState('');
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerCreating, setCustomerCreating] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('0.00');
  const [customerQuery, setCustomerQuery] = useState('');
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [surcharge, setSurcharge] = useState(0);
  const [freight, setFreight] = useState(0);
  const [cashOpening, setCashOpening] = useState(
    () => requireCashOpening && localStorage.getItem(`erp:cash-open:${offlineScope}`) !== 'open',
  );
  const [cashRegisters, setCashRegisters] = useState<CashOverview['registers']>([]);
  const [cashPrintConfirm, setCashPrintConfirm] = useState<{
    amount: number;
    notes: string;
  } | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [forcedOffline, setForcedOffline] = useState(
    () => localStorage.getItem('erp:pos-operation-mode') === 'offline',
  );
  const [pendingOffline, setPendingOffline] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const productListRef = useRef<HTMLInputElement>(null);
  const receivedAmountRef = useRef<HTMLInputElement>(null);
  const firstPaymentMethodRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const customerRef = useRef<HTMLInputElement>(null);
  const cashFormRef = useRef<HTMLFormElement>(null);
  const requestKey = useRef(randomId());
  const itemsTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0),
    [cart],
  );
  const total = itemsTotal + surcharge + freight;
  const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const received = Number(receivedAmount.replace(',', '.') || 0);
  const results = search.trim()
    ? lookup.products
        .filter((item) =>
          [item.code, item.barcode, item.description].some((field) =>
            field?.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        )
        .slice(0, 8)
    : [];
  const usesCredit = payments.some(
    (payment) =>
      lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId)?.type ===
      'credit_account',
  );

  useEffect(() => {
    void (async () => {
      if (forcedOffline) {
        const cached = await readPosLookups<Lookup>(offlineScope);
        if (!cached)
          return setError(
            'Ative o modo online uma vez para preparar este computador para uso offline',
          );
        setLookup(cached);
        applyDefaults(cached);
        setError(
          'Modo offline manual ativado: as vendas serão sincronizadas quando voltar ao online',
        );
        return;
      }
      try {
        const data = await apiRequest<Lookup>('/sales/pos/lookups');
        await cachePosLookups(offlineScope, data);
        setLookup(data);
        applyDefaults(data);
        setPayments([
          {
            key: 1,
            paymentMethodId: data.paymentMethods[0]?.id ?? '',
            amount: '0.00',
            installments: 1,
          },
        ]);
      } catch (reason) {
        const cached = await readPosLookups<Lookup>(offlineScope);
        if (!cached) return setError(message(reason));
        setLookup(cached);
        applyDefaults(cached);
        setPayments([
          {
            key: 1,
            paymentMethodId: cached.paymentMethods[0]?.id ?? '',
            amount: '0.00',
            installments: 1,
          },
        ]);
        setError('Modo offline: usando catálogo armazenado neste dispositivo');
      }
    })();
  }, [offlineScope, forcedOffline]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`erp:held-sales:${offlineScope}`) ?? '[]',
      ) as HeldSale[];
      setHeldSales(Array.isArray(saved) ? saved : []);
    } catch {
      setHeldSales([]);
    }
    if (!requireCashOpening || localStorage.getItem(`erp:cash-open:${offlineScope}`) === 'open')
      return;
    void apiRequest<CashOverview>('/cash/overview')
      .then((overview) => {
        setCashRegisters(overview.registers);
        const open = overview.sessions.find(({ status }) => status === 'open');
        if (open) {
          localStorage.setItem(`erp:cash-open:${offlineScope}`, 'open');
          setCashOpening(false);
        }
      })
      .catch((reason) => setError(message(reason)));
  }, [offlineScope, requireCashOpening]);

  function applyDefaults(data: Lookup) {
    const customer = data.settings?.defaultCustomerId;
    const seller = data.settings?.defaultSellerId;
    const location = data.settings?.defaultLocationId;
    setCustomerId(data.customers.some(({ id }) => id === customer) ? customer! : '');
    setSellerId(
      data.settings?.sellerMode === 'per_sale'
        ? ''
        : data.sellers.some(({ id }) => id === seller)
          ? seller!
          : '',
    );
    setLocationId(
      data.locations.some(({ id }) => id === location) ? location! : (data.locations[0]?.id ?? ''),
    );
  }
  useEffect(() => {
    async function updateCount() {
      setPendingOffline(await pendingCheckoutCount(offlineScope));
    }
    async function synchronize() {
      if (!navigator.onLine || forcedOffline) return;
      setOnline(true);
      setSyncing(true);
      try {
        await synchronizeCheckouts(offlineScope, (body) =>
          apiRequest('/sales/pos/checkout', { method: 'POST', body: JSON.stringify(body) }),
        );
        await updateCount();
      } finally {
        setSyncing(false);
      }
    }
    function disconnected() {
      setOnline(false);
    }
    function connected() {
      void synchronize();
    }
    void updateCount();
    void synchronize();
    window.addEventListener('offline', disconnected);
    window.addEventListener('online', connected);
    window.addEventListener('erp:offline-queue', connected);
    window.addEventListener('erp:network-restored', connected);
    return () => {
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('online', connected);
      window.removeEventListener('erp:offline-queue', connected);
      window.removeEventListener('erp:network-restored', connected);
    };
  }, [offlineScope, forcedOffline]);
  useEffect(() => {
    if (payments.length === 1)
      setPayments((current) => current.map((item) => ({ ...item, amount: total.toFixed(2) })));
  }, [total]);
  useEffect(() => {
    if (!paymentOpen) return;
    receivedAmountRef.current?.focus();
    receivedAmountRef.current?.select();
  }, [paymentOpen]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key === 'F1') {
        event.preventDefault();
        setHelpOpen(true);
      }
      if (event.key === 'F2') {
        event.preventDefault();
        setCustomerCreateOpen(false);
        setCustomerPickerOpen(true);
        requestAnimationFrame(() => customerRef.current?.focus());
      }
      if (event.key === 'F3') {
        event.preventDefault();
        setProductListOpen(true);
        requestAnimationFrame(() => productListRef.current?.focus());
      }
      if (event.key === 'F4') {
        event.preventDefault();
        setHeldSalesOpen(true);
      }
      if (event.key === 'F5') {
        event.preventDefault();
        if (helpOpen) setHelpOpen(false);
        if (productListOpen) setProductListOpen(false);
        if (cashOpening) cashFormRef.current?.requestSubmit();
        else if (cart.length) {
          setReceivedAmount(total.toFixed(2));
          setPaymentOpen(true);
          requestAnimationFrame(() => receivedAmountRef.current?.select());
        }
      }
      if (event.key === 'F6') {
        event.preventDefault();
        cancelCurrentSale();
      }
      if (event.key === 'F7') {
        event.preventDefault();
        holdCurrentSale();
      }
      if (event.key === 'F8') {
        event.preventDefault();
        if (paymentOpen && received + 0.009 < total)
          setError('O valor recebido é menor que o total da venda');
        else if (!receipt) formRef.current?.requestSubmit();
      }
      if (event.key === 'F9') {
        event.preventDefault();
        onNavigate?.('pre-sales');
      }
      if (event.key === 'F12') {
        event.preventDefault();
        setNotesOpen(true);
      }
      if (event.key === 'F10' && onOpenSettings) {
        event.preventDefault();
        onOpenSettings();
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setLocalSettingsOpen(true);
      }
      if (event.ctrlKey && event.key === 'End') {
        event.preventDefault();
        onNavigate?.('customers');
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        onNavigate?.('cash');
      }
      if (event.ctrlKey && event.altKey && event.key === '=') {
        event.preventDefault();
        onOpenSettings?.();
      }
      if (!event.ctrlKey && !event.altKey && event.key === '=') {
        event.preventDefault();
        onNavigate?.('cash');
      }
      if (!event.ctrlKey && event.key === 'End') {
        event.preventDefault();
        onNavigate?.('cash');
      }
      if (event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setCustomerPickerOpen(true);
        requestAnimationFrame(() => customerRef.current?.focus());
      }
      if (event.ctrlKey && event.key === 'F9') {
        event.preventDefault();
        onNavigate?.('pre-sales');
      }
      if (event.key === 'F11') {
        event.preventDefault();
        onNavigate?.('pos-operations');
      }
      if (event.altKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        onNavigate?.('cash-tape');
      }
      if (event.key === 'Insert') {
        event.preventDefault();
        onNavigate?.('cash');
      }
      if (event.ctrlKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        onNavigate?.('returns');
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        onNavigate?.('loyalty');
      }
      if (event.key === 'Delete' && cart.length) {
        event.preventDefault();
        setCart((current) => current.slice(0, -1));
      }
      if (
        event.key === 'Escape' &&
        (helpOpen ||
          paymentOpen ||
          heldSalesOpen ||
          customerPickerOpen ||
          sellerPickerOpen ||
          notesOpen ||
          productListOpen ||
          localSettingsOpen)
      ) {
        setHelpOpen(false);
        setPaymentOpen(false);
        setHeldSalesOpen(false);
        setCustomerPickerOpen(false);
        setSellerPickerOpen(false);
        setNotesOpen(false);
        setProductListOpen(false);
        setLocalSettingsOpen(false);
      } else if (event.key === 'Escape' && cashOpening) onExit?.();
      if (
        paymentOpen &&
        event.target !== receivedAmountRef.current &&
        /^[1-9]$/.test(event.key)
      ) {
        const method = lookup.paymentMethods[Number(event.key) - 1];
        if (method) {
          event.preventDefault();
          setPayments((current) =>
            current.map((item, index) =>
              index === 0 ? { ...item, paymentMethodId: method.id, installments: 1 } : item,
            ),
          );
        }
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [
    cart.length,
    receipt,
    onOpenSettings,
    onNavigate,
    onExit,
    helpOpen,
    paymentOpen,
    heldSalesOpen,
    customerPickerOpen,
    sellerPickerOpen,
    notesOpen,
    productListOpen,
    localSettingsOpen,
    cashOpening,
    lookup.paymentMethods,
    total,
    received,
  ]);

  function add(product: PosProduct) {
    setProductListOpen(false);
    if (product.salePrice === null && !product.openPrice)
      return setError('Produto sem preço vigente');
    if (product.selectLotAtPos) {
      const validLots = product.lots.filter(
        (lot) => !isExpired(lot.expiresAt) && Number(lot.availableQuantity) > 0,
      );
      if (!validLots.length) return setError('Produto sem lote válido e disponível para venda');
      setLotSelection(product);
      return;
    }
    commitProduct(product, null);
  }
  function commitProduct(product: PosProduct, lot: PosProduct['lots'][number] | null) {
    setCart((current) => {
      const existing = current.find(({ id }) => id === product.id);
      return existing
        ? current.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + entryQuantity } : item,
          )
        : [
            ...current,
            {
              ...product,
              quantity: entryQuantity,
              unitPrice: Number(product.salePrice ?? 0),
              discount: 0,
              lotId: lot?.id ?? null,
              lotNumber: lot?.lotNumber ?? null,
              lotExpiresAt: lot?.expiresAt ?? null,
            },
          ];
    });
    setSearch('');
    setEntryQuantity(1);
    setError('');
    setLotSelection(null);
    searchRef.current?.focus();
  }
  function addFromSearch() {
    const normalized = search.trim().toLowerCase();
    const exact = lookup.products.find(
      (item) => item.code.toLowerCase() === normalized || item.barcode === search.trim(),
    );
    const product = exact ?? results[0];
    if (product) add(product);
  }
  function update(id: string, field: 'quantity' | 'unitPrice' | 'discount', value: number) {
    setCart((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: Math.max(0, value) } : item)),
    );
  }
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) return setError('Adicione ao menos um produto');
    if (!locationId) return setError('Configure a movimentação interna do PDV');
    if (Math.abs(paid - total) > 0.009)
      return setError('Os pagamentos devem fechar exatamente o total da venda');
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (forcedOffline) throw new TypeError('Modo offline manual ativado');
      const body = {
        idempotencyKey: requestKey.current,
        customerId: customerId || null,
        sellerId: sellerId || null,
        locationId,
        surcharge,
        freight,
        notes: saleNotes.trim() || null,
        creditDueDate: field(form, 'creditDueDate'),
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.openPrice ? item.unitPrice : null,
          discount: item.discount,
          lotId: item.lotId,
        })),
        payments: payments.map(({ paymentMethodId, amount, installments }) => ({
          paymentMethodId,
          amount,
          installments,
        })),
      };
      const result = await apiRequest<PosCheckoutResult>('/sales/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setReceipt({
        ...result,
        customerName: lookup.customers.find(({ id }) => id === body.customerId)?.name,
        sellerName: lookup.sellers.find(({ id }) => id === body.sellerId)?.name,
        lines: cart.map((item) => ({
          code: item.code,
          description: item.description,
          unit: item.unitCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice - item.discount,
        })),
        payments: payments.map((payment) => ({
          name:
            lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId)?.name ??
            'Pagamento',
          amount: Number(payment.amount),
          netAmount: paymentNet(lookup, payment),
        })),
      });
      setPaymentOpen(false);
      reset(false);
    } catch (reason) {
      if (!navigator.onLine || isNetworkFailure(reason)) {
        const key = requestKey.current;
        const body = {
          idempotencyKey: key,
          customerId: customerId || null,
          sellerId: sellerId || null,
          locationId,
          surcharge,
          freight,
          notes: saleNotes.trim() || null,
          creditDueDate: field(form, 'creditDueDate'),
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            unitPrice: item.openPrice ? item.unitPrice : null,
            discount: item.discount,
            lotId: item.lotId,
          })),
          payments: payments.map(({ paymentMethodId, amount, installments }) => ({
            paymentMethodId,
            amount,
            installments,
          })),
        };
        await enqueueCheckout({
          id: key,
          scope: offlineScope,
          body,
          total,
          itemCount: cart.length,
          createdAt: new Date().toISOString(),
          attempts: 0,
          lastError: null,
        });
        setPendingOffline(await pendingCheckoutCount(offlineScope));
        setReceipt({
          orderId: `offline:${key}`,
          orderNumber: 'PENDENTE',
          saleId: `offline:${key}`,
          saleNumber: `OFF-${key.slice(0, 8).toUpperCase()}`,
          total: total.toFixed(2),
          itemCount: cart.length,
          paymentCount: payments.length,
          soldAt: new Date().toISOString(),
          issuer: lookup.issuer,
          offlinePending: true,
          customerName: lookup.customers.find(({ id }) => id === body.customerId)?.name,
          sellerName: lookup.sellers.find(({ id }) => id === body.sellerId)?.name,
          lines: cart.map((item) => ({
            code: item.code,
            description: item.description,
            unit: item.unitCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice - item.discount,
          })),
          payments: payments.map((payment) => ({
            name:
              lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId)?.name ??
              'Pagamento',
            amount: Number(payment.amount),
            netAmount: paymentNet(lookup, payment),
          })),
        });
        setPaymentOpen(false);
        reset(false);
      } else setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  function reset(clearReceipt = true) {
    setCart([]);
    setSearch('');
    setCustomerId(lookup.settings?.defaultCustomerId ?? '');
    setSellerId(
      lookup.settings?.sellerMode === 'per_sale' ? '' : (lookup.settings?.defaultSellerId ?? ''),
    );
    setPayments([
      {
        key: 1,
        paymentMethodId: lookup.paymentMethods[0]?.id ?? '',
        amount: '0.00',
        installments: 1,
      },
    ]);
    setSurcharge(0);
    setFreight(0);
    setSaleNotes('');
    requestKey.current = randomId();
    if (clearReceipt) setReceipt(null);
  }
  function cancelCurrentSale() {
    if (!cart.length) return;
    if (!window.confirm('Cancelar a venda atual e remover todos os itens?')) return;
    reset();
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  function setOperationMode(nextOffline: boolean) {
    localStorage.setItem('erp:pos-operation-mode', nextOffline ? 'offline' : 'online');
    setForcedOffline(nextOffline);
    if (!nextOffline) {
      setError(navigator.onLine ? '' : 'Sem conexão física: o PDV continuará offline');
      window.dispatchEvent(new Event('erp:network-restored'));
    }
  }
  function holdCurrentSale() {
    if (!cart.length) return setError('Não há itens para aguardar');
    const held: HeldSale = {
      id: randomId(),
      createdAt: new Date().toISOString(),
      cart,
      payments,
      customerId,
      sellerId,
      surcharge,
      freight,
    };
    const next = [held, ...heldSales];
    setHeldSales(next);
    localStorage.setItem(`erp:held-sales:${offlineScope}`, JSON.stringify(next));
    reset();
    setError('Venda colocada em espera. Use F4 para retomá-la.');
  }
  function restoreHeldSale(sale: HeldSale) {
    setCart(sale.cart);
    setPayments(sale.payments);
    setCustomerId(sale.customerId);
    setSellerId(sale.sellerId);
    setSurcharge(sale.surcharge ?? 0);
    setFreight(sale.freight ?? 0);
    const next = heldSales.filter(({ id }) => id !== sale.id);
    setHeldSales(next);
    localStorage.setItem(`erp:held-sales:${offlineScope}`, JSON.stringify(next));
    setHeldSalesOpen(false);
  }
  async function openCash(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const registerId = field(form, 'registerId') ?? cashRegisters[0]?.id;
    if (!registerId) return setError('Cadastre um caixa antes de iniciar o PDV');
    const amount = Number(field(form, 'openingAmount') ?? 0);
    const notes = field(form, 'openingNotes') ?? '';
    setBusy(true);
    try {
      await apiRequest('/cash/open', {
        method: 'POST',
        body: JSON.stringify({ registerId, openingAmount: amount }),
      });
      localStorage.setItem(`erp:cash-open:${offlineScope}`, 'open');
      setCashOpening(false);
      setCashPrintConfirm({ amount, notes });
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  function printCashOpening(data: { amount: number; notes: string }) {
    const target = window.open('', '_blank', 'popup,width=420,height=620');
    if (!target) return;
    target.document.write(
      `<html><head><title>Abertura de caixa</title><style>@page{size:80mm auto;margin:2mm}body{width:72mm;font:12px monospace;text-align:center}.line{border-top:1px dashed;margin:8px 0}</style></head><body><h2>${escapeHtml(lookup.issuer.tradeName || lookup.issuer.legalName)}</h2><p>${escapeHtml(lookup.issuer.legalName)}</p><div class="line"></div><h3>COMPROVANTE DE ABERTURA DE CAIXA</h3><p>${new Date().toLocaleString('pt-BR')}</p><p>Valor de abertura: <b>${money(data.amount)}</b></p><p>${escapeHtml(data.notes)}</p><script>window.onload=()=>window.print()</script></body></html>`,
    );
    target.document.close();
  }
  function runHelpAction(action: string) {
    setHelpOpen(false);
    if (action === 'hold') holdCurrentSale();
    else if (action === 'held') setHeldSalesOpen(true);
    else if (action === 'customers') onNavigate?.('customers');
    else if (action === 'cancel') cancelCurrentSale();
    else if (action === 'remove') setCart((current) => current.slice(0, -1));
    else if (action === 'settings') setLocalSettingsOpen(true);
    else if (action === 'cash') onNavigate?.('cash');
    else if (action === 'payment') setPaymentOpen(true);
    else if (action === 'quick') formRef.current?.requestSubmit();
    else if (action === 'customer') openCustomerPicker();
    else if (action === 'notes') setNotesOpen(true);
    else if (action === 'products') {
      setProductListOpen(true);
      requestAnimationFrame(() => productListRef.current?.focus());
    } else if (action === 'presales') onNavigate?.('pre-sales');
    else if (action === 'operations') onNavigate?.('pos-operations');
    else if (action === 'tape') onNavigate?.('cash-tape');
    else if (action === 'returns') onNavigate?.('returns');
    else if (action === 'loyalty') onNavigate?.('loyalty');
  }
  function applyAdjustment(kind: 'discount' | 'surcharge' | 'freight') {
    if (!cart.length) return;
    const label = kind === 'discount' ? 'desconto' : kind === 'surcharge' ? 'acréscimo' : 'frete';
    const value = Number(
      window.prompt(`Informe o valor do ${label}`, '0,00')?.replace(',', '.') ?? 0,
    );
    if (!Number.isFinite(value) || value < 0) return setError('Informe um valor válido');
    if (kind === 'surcharge') setSurcharge(value);
    else if (kind === 'freight') setFreight(value);
    else if (!canDiscount) setError('Operador sem permissão para aplicar desconto');
    else
      setCart((current) =>
        current.map((item, index) =>
          index === 0
            ? { ...item, discount: Math.min(value, item.quantity * item.unitPrice) }
            : item,
        ),
      );
  }
  function openCustomerPicker() {
    setCustomerCreateOpen(false);
    setCustomerPickerOpen(true);
    requestAnimationFrame(() => customerRef.current?.focus());
  }
  async function createQuickCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const legalName = field(form, 'legalName') ?? '';
    const phone = field(form, 'phone') ?? '';
    const taxId = (field(form, 'taxId') ?? '').replace(/\D/g, '');
    const email = field(form, 'email') ?? '';
    const whatsapp = field(form, 'whatsapp') ?? '';
    setCustomerCreating(true);
    setError('');
    try {
      const customer = await apiRequest<{ id: string; legalName: string }>('/master/customers', {
        method: 'POST',
        body: JSON.stringify({
          personType: taxId.length === 14 ? 'J' : 'F',
          taxId: taxId || null,
          legalName,
          tradeName: null,
          phone,
          whatsapp: whatsapp || null,
          email: email || null,
          creditLimit: 0,
          addresses: [],
        }),
      });
      setLookup((current) => ({
        ...current,
        customers: [...current.customers, { id: customer.id, name: customer.legalName }],
      }));
      setCustomerId(customer.id);
      setCustomerCreateOpen(false);
      setCustomerPickerOpen(false);
      setCustomerQuery('');
    } catch (reason) {
      setError(message(reason));
    } finally {
      setCustomerCreating(false);
    }
  }
  return (
    <section className="pos-screen">
      <header className="pos-header">
        <div className="pos-brand">
          <span className="pos-brand-mark">SL</span>
          <span>
            <strong>SoftLab Varejo</strong>
            <small>Frente de caixa</small>
          </span>
        </div>
        <h1>{cart.length ? 'Venda em andamento' : 'Liberado para uma nova venda'}</h1>
        <div className="pos-header-tools">
          <div className={`pos-connectivity ${online && !forcedOffline ? 'online' : 'offline'}`}>
            <span>{online && !forcedOffline ? '● Online' : '● Offline'}</span>
            {pendingOffline > 0 && (
              <strong>
                {syncing ? 'Sincronizando…' : `${pendingOffline} venda(s) pendente(s)`}
              </strong>
            )}
          </div>
          <div className="pos-mode-switch" role="group" aria-label="Modo de operação do PDV">
            <button
              type="button"
              className={!forcedOffline ? 'active' : ''}
              aria-pressed={!forcedOffline}
              onClick={() => setOperationMode(false)}
            >
              Trabalhar online
            </button>
            <button
              type="button"
              className={forcedOffline ? 'active' : ''}
              aria-pressed={forcedOffline}
              onClick={() => setOperationMode(true)}
            >
              Trabalhar offline
            </button>
          </div>
          <button
            type="button"
            className="pos-help-button"
            onClick={() => setHelpOpen(true)}
            aria-label="Ajuda e atalhos (F1)"
          >
            ?
          </button>
          {onExit && (
            <button type="button" className="pos-exit-button" onClick={onExit}>
              Sair
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {receipt && (
        <SaleCompletionDialog
          receipt={receipt}
          onNext={() => {
            setReceipt(null);
            searchRef.current?.focus();
          }}
        />
      )}
      {lotSelection && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="lot-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lot-picker-title"
          >
            <header>
              <div>
                <span className="eyebrow">RASTREABILIDADE</span>
                <h2 id="lot-picker-title">Selecione o lote</h2>
                <p>
                  {lotSelection.code} · {lotSelection.description}
                </p>
              </div>
              <button type="button" className="quiet" onClick={() => setLotSelection(null)}>
                Fechar
              </button>
            </header>
            <div className="lot-picker-list">
              {lotSelection.lots.map((lot) => {
                const expired = isExpired(lot.expiresAt);
                const unavailable = Number(lot.availableQuantity) <= 0;
                return (
                  <button
                    type="button"
                    key={lot.id}
                    disabled={expired || unavailable}
                    onClick={() => commitProduct(lotSelection, lot)}
                  >
                    <span>
                      <strong>Lote {lot.lotNumber}</strong>
                      <small>
                        {lot.expiresAt
                          ? `Validade ${date(lot.expiresAt)}`
                          : 'Sem validade informada'}
                      </small>
                    </span>
                    <span className={expired ? 'lot-expired' : ''}>
                      {expired
                        ? 'Vencido'
                        : unavailable
                          ? 'Sem saldo'
                          : `${number(lot.availableQuantity)} disponível`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {helpOpen && (
        <div className="modal-backdrop pos-modal-layer" role="presentation">
          <section
            className="pos-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-help-title"
          >
            <header>
              <div>
                <span className="eyebrow">ATALHOS DO OPERADOR</span>
                <h2 id="pos-help-title">Menu de funções</h2>
              </div>
              <button type="button" className="quiet" onClick={() => setHelpOpen(false)}>
                Fechar
              </button>
            </header>
            <div className="pos-help-head">
              <span>Descrição</span>
              <span>Atalho</span>
            </div>
            <div className="pos-help-list">
              {POS_HELP_ACTIONS.map((item) => (
                <button type="button" key={item.label} onClick={() => runHelpAction(item.action)}>
                  <strong>{item.label}</strong>
                  <kbd>{item.shortcut}</kbd>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {productListOpen && (
        <div className="modal-backdrop pos-modal-layer" role="presentation">
          <section
            className="pos-party-modal pos-product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-list-title"
          >
            <header>
              <div>
                <span className="eyebrow">F3 · CATÁLOGO</span>
                <h2 id="product-list-title">Localizar produto</h2>
              </div>
              <button type="button" className="quiet" onClick={() => setProductListOpen(false)}>
                Fechar
              </button>
            </header>
            <input
              ref={productListRef}
              value={productListQuery}
              onChange={(event) => setProductListQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const query = productListQuery.trim().toLowerCase();
                const product = lookup.products.find((item) =>
                  [item.code, item.barcode, item.description].some((value) =>
                    value?.toLowerCase().includes(query),
                  ),
                );
                if (product) add(product);
              }}
              placeholder="Código, código de barras ou descrição"
              autoFocus
            />
            <div className="pos-product-list">
              {lookup.products
                .filter((product) =>
                  [product.code, product.barcode, product.description].some((value) =>
                    value?.toLowerCase().includes(productListQuery.trim().toLowerCase()),
                  ),
                )
                .map((product) => (
                  <button type="button" key={product.id} onClick={() => add(product)}>
                    <span>
                      <strong>
                        {product.code} · {product.description}
                      </strong>
                      <small>
                        {product.barcode || 'Sem código de barras'} · Disponível{' '}
                        {number(product.availableQuantity)}
                      </small>
                    </span>
                    <b>{product.salePrice === null ? 'Preço aberto' : money(product.salePrice)}</b>
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}
      {heldSalesOpen && (
        <div className="modal-backdrop pos-modal-layer" role="presentation">
          <section
            className="pos-held-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="held-title"
          >
            <header>
              <div>
                <span className="eyebrow">F4 · VENDAS AGUARDANDO</span>
                <h2 id="held-title">Retomar venda</h2>
              </div>
              <button type="button" className="quiet" onClick={() => setHeldSalesOpen(false)}>
                Fechar
              </button>
            </header>
            {heldSales.length === 0 ? (
              <div className="pos-modal-empty">Nenhuma venda está aguardando.</div>
            ) : (
              heldSales.map((sale) => (
                <button
                  type="button"
                  className="pos-held-sale"
                  key={sale.id}
                  onClick={() => restoreHeldSale(sale)}
                >
                  <span>
                    <strong>{new Date(sale.createdAt).toLocaleString('pt-BR')}</strong>
                    <small>{sale.cart.length} item(ns)</small>
                  </span>
                  <b>
                    {money(
                      sale.cart.reduce(
                        (sum, item) => sum + item.quantity * item.unitPrice - item.discount,
                        0,
                      ),
                    )}
                  </b>
                </button>
              ))
            )}
          </section>
        </div>
      )}
      {customerPickerOpen && (
        <div className="modal-backdrop pos-modal-layer" role="presentation">
          <section
            className="pos-party-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-picker-title"
          >
            <header>
              <div>
                <span className="eyebrow">F2 · IDENTIFICAÇÃO</span>
                <h2 id="customer-picker-title">Identificar cliente</h2>
              </div>
              <button type="button" className="quiet" onClick={() => setCustomerPickerOpen(false)}>
                Fechar
              </button>
            </header>
            {customerCreateOpen ? (
              <form
                className="pos-quick-customer"
                onSubmit={(event) => void createQuickCustomer(event)}
              >
                <label>
                  Nome
                  <input name="legalName" required minLength={2} autoFocus />
                </label>
                <label>
                  Telefone
                  <input name="phone" required inputMode="tel" placeholder="(00) 00000-0000" />
                </label>
                <div>
                  <label>
                    CPF ou CNPJ <small>Opcional</small>
                    <input name="taxId" inputMode="numeric" />
                  </label>
                  <label>
                    E-mail <small>Opcional</small>
                    <input name="email" type="email" />
                  </label>
                </div>
                <label>
                  WhatsApp <small>Opcional</small>
                  <input name="whatsapp" inputMode="tel" />
                </label>
                <footer>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => setCustomerCreateOpen(false)}
                  >
                    Voltar para pesquisa
                  </button>
                  <button className="primary" disabled={customerCreating}>
                    {customerCreating ? 'Salvando…' : 'Salvar e identificar'}
                  </button>
                </footer>
              </form>
            ) : (
              <>
                <input
                  ref={customerRef}
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Nome, CPF, CNPJ ou telefone"
                  autoFocus
                />
                <div className="pos-party-list">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId('');
                      setCustomerPickerOpen(false);
                    }}
                  >
                    <span>
                      <strong>Consumidor não identificado</strong>
                      <small>Venda sem identificação</small>
                    </span>
                    <b>Selecionar</b>
                  </button>
                  {lookup.customers
                    .filter((customer) =>
                      customer.name.toLowerCase().includes(customerQuery.trim().toLowerCase()),
                    )
                    .map((customer) => (
                      <button
                        type="button"
                        key={customer.id}
                        onClick={() => {
                          setCustomerId(customer.id);
                          setCustomerPickerOpen(false);
                        }}
                      >
                        <span>
                          <strong>{customer.name}</strong>
                          <small>Cliente cadastrado</small>
                        </span>
                        <b>Selecionar</b>
                      </button>
                    ))}
                </div>
                <footer>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => setCustomerCreateOpen(true)}
                  >
                    Cadastrar novo cliente
                  </button>
                  {customerId && canReadCredit && (
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        setCustomerPickerOpen(false);
                        setStatementOpen(true);
                      }}
                    >
                      Extrato do cliente
                    </button>
                  )}
                </footer>
              </>
            )}
          </section>
        </div>
      )}
      {sellerPickerOpen && (
        <div className="modal-backdrop pos-modal-layer" role="presentation">
          <section
            className="pos-party-modal pos-seller-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-picker-title"
          >
            <header>
              <div>
                <span className="eyebrow">VENDEDOR OBRIGATÓRIO</span>
                <h2 id="seller-picker-title">Identificar vendedor</h2>
              </div>
              <button type="button" className="quiet" onClick={() => setSellerPickerOpen(false)}>
                Fechar
              </button>
            </header>
            <div className="pos-party-list">
              {lookup.sellers.map((seller) => (
                <button
                  type="button"
                  key={seller.id}
                  onClick={() => {
                    setSellerId(seller.id);
                    setSellerPickerOpen(false);
                    searchRef.current?.focus();
                  }}
                >
                  <span>
                    <strong>{seller.name}</strong>
                    <small>Vendedor disponível</small>
                  </span>
                  <b>Selecionar</b>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {notesOpen && (
        <div className="modal-backdrop pos-modal-layer" role="presentation">
          <section
            className="pos-party-modal pos-notes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notes-title"
          >
            <header>
              <div>
                <span className="eyebrow">F12 · VENDA ATUAL</span>
                <h2 id="notes-title">Observações da venda</h2>
              </div>
              <button type="button" className="quiet" onClick={() => setNotesOpen(false)}>
                Fechar
              </button>
            </header>
            <textarea
              value={saleNotes}
              onChange={(event) => setSaleNotes(event.target.value)}
              rows={7}
              autoFocus
              placeholder="Digite uma observação para esta venda"
            />
            <footer>
              <button type="button" className="primary" onClick={() => setNotesOpen(false)}>
                Salvar observação
              </button>
            </footer>
          </section>
        </div>
      )}
      {cashOpening && (
        <div className="modal-backdrop pos-modal-layer pos-cash-backdrop" role="presentation">
          <form
            ref={cashFormRef}
            className="pos-cash-modal"
            onSubmit={(event) => void openCash(event)}
          >
            <header>
              <div>
                <span className="eyebrow">INÍCIO DO TURNO</span>
                <h2>Abertura de caixa</h2>
              </div>
            </header>
            {cashRegisters.length > 1 && (
              <label>
                Caixa
                <select name="registerId" required>
                  {cashRegisters.map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Valor de abertura
              <input
                name="openingAmount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0.00"
                autoFocus
              />
            </label>
            <label>
              Observação
              <textarea name="openingNotes" rows={4} />
            </label>
            <footer>
              <button type="button" className="quiet" onClick={onExit}>
                Sair (ESC)
              </button>
              <button className="primary" disabled={busy}>
                {busy ? 'Abrindo…' : 'Abrir caixa (F5)'}
              </button>
            </footer>
          </form>
        </div>
      )}
      {cashPrintConfirm && (
        <div className="modal-backdrop pos-modal-layer pos-confirm-backdrop" role="presentation">
          <section
            className="pos-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="print-cash-title"
          >
            <span className="pos-info-icon">i</span>
            <div>
              <h3 id="print-cash-title">Comprovante de abertura</h3>
              <p>Deseja imprimir o comprovante de abertura de caixa?</p>
              <footer>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    printCashOpening(cashPrintConfirm);
                    setCashPrintConfirm(null);
                  }}
                >
                  Sim
                </button>
                <button type="button" className="quiet" onClick={() => setCashPrintConfirm(null)}>
                  Não
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
      <form ref={formRef} className="pos-layout" onSubmit={(event) => void checkout(event)}>
        <main className="pos-catalog">
          <div className="pos-search">
            <span className="pos-search-label">
              Código, código de barras ou descrição <kbd>F3</kbd>
            </span>
            <input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                const normalized = value.trim().toLowerCase();
                const exact = lookup.products.find(
                  (product) =>
                    product.code.toLowerCase() === normalized || product.barcode === value.trim(),
                );
                if (exact) add(exact);
              }}
              onKeyDown={(event) => {
                if (event.key === '*') {
                  event.preventDefault();
                  const quantity = Number(search.replace(',', '.'));
                  if (Number.isFinite(quantity) && quantity > 0) {
                    setEntryQuantity(quantity);
                    setSearch('');
                    setError(`Quantidade preparada: ${number(quantity)}`);
                  } else setError('Digite uma quantidade válida antes de pressionar *');
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addFromSearch();
                }
              }}
              placeholder="Código, código de barras ou descrição"
            />
          </div>
          <div className="pos-entry-metrics">
            <div>
              <span>Quantidade</span>
              <strong>{number(entryQuantity)}</strong>
            </div>
            <div>
              <span>Preço unitário</span>
              <strong>{money(cart.at(-1)?.unitPrice ?? 0)}</strong>
            </div>
          </div>
        </main>
        <aside className="pos-checkout">
          <div className="pos-sale-context">
            <span>
              Vendedor:{' '}
              <strong>Consumidor final</strong>
            </span>
            {customerId && (
              <span>
                Cliente:{' '}
                <strong>{lookup.customers.find(({ id }) => id === customerId)?.name}</strong>
              </span>
            )}
          </div>
          <div className="pos-cart">
            <div className="pos-cart-head">
              <span># Produto</span>
              <span>Qtd.</span>
              <span>Preço</span>
              <span>Desc.</span>
              <span>Total</span>
              <span />
            </div>
            {cart.map((item) => (
              <div className="pos-cart-row" key={item.id}>
                <span>
                  <strong>{item.code}</strong>
                  {item.description}
                  <small>
                    {item.lotNumber
                      ? `Lote ${item.lotNumber}${item.lotExpiresAt ? ` · val. ${date(item.lotExpiresAt)}` : ''}`
                      : item.controlsLot
                        ? 'Baixa automática FEFO'
                        : `Disponível ${number(item.availableQuantity)}`}
                  </small>
                </span>
                <input
                  aria-label={`Quantidade de ${item.description}`}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={item.quantity}
                  onChange={(event) => update(item.id, 'quantity', Number(event.target.value))}
                />
                <input
                  aria-label={`Preço de ${item.description}`}
                  type="number"
                  min="0"
                  step="0.01"
                  readOnly={!item.openPrice}
                  value={item.unitPrice}
                  onChange={(event) => update(item.id, 'unitPrice', Number(event.target.value))}
                />
                <input
                  aria-label={`Desconto de ${item.description}`}
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canDiscount}
                  value={item.discount}
                  onChange={(event) => update(item.id, 'discount', Number(event.target.value))}
                />
                <strong>{money(item.quantity * item.unitPrice - item.discount)}</strong>
                <button
                  type="button"
                  className="pos-remove"
                  aria-label={`Remover ${item.description}`}
                  onClick={() => setCart((current) => current.filter(({ id }) => id !== item.id))}
                >
                  ×
                </button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="pos-empty">
                Leia um código de barras ou pesquise um produto para começar.
              </div>
            )}
          </div>
          <div className="pos-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
            <small>{cart.length} produtos no carrinho</small>
          </div>
          <button
            type="button"
            className="pos-open-payment"
            disabled={!cart.length}
            onClick={() => {
              setReceivedAmount(total.toFixed(2));
              setPaymentOpen(true);
              requestAnimationFrame(() => receivedAmountRef.current?.select());
            }}
          >
            Finalizar (F5)
          </button>
          {paymentOpen && (
            <div className="modal-backdrop pos-modal-layer" role="presentation">
              <section
                className="pos-payment-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="payment-title"
              >
                <header>
                  <div>
                    <span className="eyebrow">FINALIZAÇÃO DA VENDA</span>
                    <h2 id="payment-title">Forma de recebimento</h2>
                  </div>
                  <button type="button" className="quiet" onClick={() => setPaymentOpen(false)}>
                    Fechar
                  </button>
                </header>
                <div className="pos-payment-summary">
                  <span>
                    Subtotal <strong>{money(total)}</strong>
                  </span>
                  <span>
                    {received > total ? 'Troco' : 'Saldo'}{' '}
                    <strong>{money(Math.abs(total - received))}</strong>
                  </span>
                  <label>
                    Valor recebido
                    <input
                      ref={receivedAmountRef}
                      value={receivedAmount}
                      inputMode="decimal"
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => setReceivedAmount(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          firstPaymentMethodRef.current?.focus();
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="pos-payment-adjustments">
                  <button type="button" onClick={() => applyAdjustment('discount')}>
                    Desconto (-)
                  </button>
                  <button type="button" onClick={() => applyAdjustment('freight')}>
                    Frete
                  </button>
                  <button type="button" onClick={() => applyAdjustment('surcharge')}>
                    Acréscimo (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentOpen(false);
                      onNavigate?.('returns');
                    }}
                  >
                    Troca (Ctrl + T)
                  </button>
                </div>
                <div className="pos-payment-method-index">
                  {lookup.paymentMethods.map((method, index) => (
                    <button
                      type="button"
                      key={method.id}
                      ref={index === 0 ? firstPaymentMethodRef : undefined}
                      className={payments[0]?.paymentMethodId === method.id ? 'selected' : ''}
                      onClick={() =>
                        setPayments((current) =>
                          current.map((item, paymentIndex) =>
                            paymentIndex === 0
                              ? { ...item, paymentMethodId: method.id, installments: 1 }
                              : item,
                          ),
                        )
                      }
                    >
                      <kbd>{index + 1}</kbd> {method.name}
                    </button>
                  ))}
                </div>
                <h2>Pagamentos selecionados</h2>
                {payments.map((payment) => (
                  <div className="pos-payment" key={payment.key}>
                    <select
                      aria-label="Forma de pagamento"
                      required
                      value={payment.paymentMethodId}
                      onChange={(event) =>
                        setPayments((current) =>
                          current.map((item) =>
                            item.key === payment.key
                              ? { ...item, paymentMethodId: event.target.value, installments: 1 }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">Forma</option>
                      {lookup.paymentMethods
                        .filter(
                          (method) =>
                            method.id === payment.paymentMethodId ||
                            !payments.some(({ paymentMethodId }) => paymentMethodId === method.id),
                        )
                        .map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.name}
                          </option>
                        ))}
                    </select>
                    <input
                      aria-label="Valor do pagamento"
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={payment.amount}
                      onChange={(event) =>
                        setPayments((current) =>
                          current.map((item) =>
                            item.key === payment.key
                              ? { ...item, amount: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    {lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId)
                      ?.type === 'credit_card' && (
                      <select
                        aria-label="Parcelas"
                        value={payment.installments}
                        onChange={(event) =>
                          setPayments((current) =>
                            current.map((item) =>
                              item.key === payment.key
                                ? { ...item, installments: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      >
                        {Array.from(
                          {
                            length:
                              lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId)
                                ?.maxInstallments ?? 1,
                          },
                          (_, installment) => installment + 1,
                        ).map((installment) => (
                          <option key={installment} value={installment}>
                            {installment}x
                          </option>
                        ))}
                      </select>
                    )}
                    {payments.length > 1 && (
                      <button
                        type="button"
                        className="pos-remove"
                        onClick={() =>
                          setPayments((current) => current.filter(({ key }) => key !== payment.key))
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {payments.map((payment) => {
                  const method = lookup.paymentMethods.find(
                    ({ id }) => id === payment.paymentMethodId,
                  );
                  if (!method?.cardConfiguration) return null;
                  const rate = paymentRate(method, payment.installments);
                  return (
                    <small className="pos-net-amount" key={`net-${payment.key}`}>
                      {method.cardConfiguration.operatorName}: líquido{' '}
                      {money(paymentNet(lookup, payment))} · taxa{' '}
                      {rate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% · D+
                      {method.cardConfiguration.settlementDays}
                    </small>
                  );
                })}
                <button
                  type="button"
                  className="quiet"
                  disabled={payments.length >= lookup.paymentMethods.length}
                  onClick={() =>
                    setPayments((current) => [
                      ...current,
                      {
                        key: Math.max(...current.map(({ key }) => key)) + 1,
                        paymentMethodId:
                          lookup.paymentMethods.find(
                            ({ id }) =>
                              !current.some(({ paymentMethodId }) => paymentMethodId === id),
                          )?.id ?? '',
                        amount: Math.max(0, total - paid).toFixed(2),
                        installments: 1,
                      },
                    ])
                  }
                >
                  + Forma de pagamento
                </button>
                <div className={`pos-balance ${Math.abs(total - paid) < 0.009 ? 'ok' : ''}`}>
                  <span>Falta</span>
                  <strong>{money(Math.max(0, total - paid))}</strong>
                </div>
                {usesCredit && (
                  <label>
                    Vencimento do crediário
                    <input
                      name="creditDueDate"
                      type="date"
                      required
                      defaultValue={futureDate(30)}
                    />
                  </label>
                )}
                <label>
                  Observações
                  <textarea name="notes" rows={2} />
                </label>
                <button
                  className="pos-finish"
                  disabled={
                    busy ||
                    !cart.length ||
                    Math.abs(total - paid) > 0.009 ||
                    received + 0.009 < total
                  }
                >
                  {busy ? 'Finalizando…' : 'Confirmar venda (F8)'}
                </button>
              </section>
            </div>
          )}
        </aside>
      </form>
      <nav className="pos-bottom-actions" aria-label="Operações do caixa">
        <button
          type="button"
          className="featured"
          onClick={holdCurrentSale}
          disabled={!cart.length}
        >
          Aguardar <kbd>F7</kbd>
        </button>
        <button type="button" onClick={cancelCurrentSale} disabled={!cart.length}>
          Cancelar <kbd>F6</kbd>
        </button>
        <button
          type="button"
          className="featured"
          onClick={() => formRef.current?.requestSubmit()}
          disabled={!cart.length}
        >
          Finalizar rápido <kbd>F8</kbd>
        </button>
        <button type="button" onClick={() => setHeldSalesOpen(true)}>
          Vendas <kbd>F4</kbd>
        </button>
        <button type="button" onClick={openCustomerPicker}>
          Cliente <kbd>F2</kbd>
        </button>
        <button type="button" onClick={() => setNotesOpen(true)} disabled={!cart.length}>
          Observações <kbd>F12</kbd>
        </button>
      </nav>
      {localSettingsOpen && <PosSettingsDialog onClose={() => setLocalSettingsOpen(false)} />}
      {statementOpen && customerId && (
        <CustomerStatementPanel
          customerId={customerId}
          paymentMethods={lookup.paymentMethods}
          canReceive={canReceiveCredit}
          onClose={() => setStatementOpen(false)}
        />
      )}
    </section>
  );
}

function paymentRate(method: Lookup['paymentMethods'][number], installments: number) {
  const configuration = method.cardConfiguration;
  if (!configuration) return 0;
  if (method.type === 'debit_card') return Number(configuration.debitRate);
  if (method.type === 'credit_card')
    return (
      Number(configuration.creditRate) +
      Number(configuration.installmentRate) * Math.max(0, installments - 1)
    );
  return 0;
}
function paymentNet(lookup: Lookup, payment: PaymentDraft) {
  const method = lookup.paymentMethods.find(({ id }) => id === payment.paymentMethodId);
  const amount = Number(payment.amount || 0);
  return method ? amount * (1 - paymentRate(method, payment.installments) / 100) : amount;
}
function field(form: FormData, name: string) {
  const raw = form.get(name);
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || null;
}
function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function number(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function date(value: string) {
  return new Date(value).toLocaleDateString('pt-BR');
}
function futureDate(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}
function isExpired(value: string | null) {
  if (!value) return false;
  const expiry = new Date(value);
  expiry.setHours(23, 59, 59, 999);
  return expiry < new Date();
}
function randomId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '018f4f12-2222-7222-8222-111111111111';
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Falha no PDV';
}

const POS_HELP_ACTIONS = [
  { label: 'Ajuda', shortcut: 'F1', action: 'help' },
  { label: 'Aguardar', shortcut: 'F7', action: 'hold' },
  { label: 'Aguardando', shortcut: 'F4', action: 'held' },
  { label: 'Cadastrar cliente', shortcut: 'CTRL + END', action: 'customers' },
  { label: 'Cancelar cupom', shortcut: 'F6', action: 'cancel' },
  { label: 'Cancelar item', shortcut: 'DELETE', action: 'remove' },
  { label: 'Configurar Certificado', shortcut: 'CTRL + ALT + =', action: 'settings' },
  { label: 'Fechar caixa', shortcut: '=', action: 'cash' },
  { label: 'Finalizar cupom', shortcut: 'F5', action: 'payment' },
  { label: 'Finalizar rápido', shortcut: 'F8', action: 'quick' },
  { label: 'Gaveta', shortcut: 'END', action: 'cash' },
  { label: 'Configurações', shortcut: 'HOME', action: 'settings' },
  { label: 'Inserir cliente', shortcut: 'ALT + C', action: 'customer' },
  { label: 'Lançamentos de caixa', shortcut: 'CTRL + R', action: 'cash' },
  { label: 'Observações', shortcut: 'F12', action: 'notes' },
  { label: 'Pesquisar cliente', shortcut: 'F2', action: 'customer' },
  { label: 'Pesquisar produtos', shortcut: 'F3', action: 'products' },
  { label: 'Pré Vendas', shortcut: 'F9', action: 'presales' },
  { label: 'Pré Vendas Locais', shortcut: 'CTRL + F9', action: 'presales' },
  { label: 'Recebimento de conta', shortcut: 'F11', action: 'operations' },
  { label: 'Reimpressão de carnê', shortcut: 'ALT + R', action: 'tape' },
  { label: 'Sangria/suprimento', shortcut: 'INSERT', action: 'cash' },
  { label: 'Sangria de pagamento', shortcut: 'ALT + INSERT', action: 'cash' },
  { label: 'Troca/Devolução de produtos', shortcut: 'CTRL + T', action: 'returns' },
  { label: 'GiftCard', shortcut: 'CTRL + G', action: 'loyalty' },
  { label: 'GiftCards gerados', shortcut: 'CTRL + ALT + G', action: 'loyalty' },
] as const;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ??
      character,
  );
}
