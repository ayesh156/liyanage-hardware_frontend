import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/use-mobile';
import { useDropdownPosition } from '../hooks/use-dropdown-position';
import { useColumnResize, ColumnResizeConfig } from '../hooks/useColumnResize';
import { useCatalog } from '../contexts/CatalogContext';
import { DisplaySettingsModal } from '../components/modals/DisplaySettingsModal';
import { mockProducts, mockInvoices } from '../data/mockData';
import { api } from '../lib/api';
import { Product, Invoice, InvoiceItem, FlattenedProduct, InventoryProduct, Customer } from '../types/index';
import { flattenProducts } from '../lib/utils';
import { printInvoice } from '../components/modals/PrintInvoiceModal';
import ThermalReceiptPreview from '../components/ThermalReceiptPreview';
import { ShortcutMapOverlay, ShortcutHintsBar, CheckoutMode, InvoiceStep } from '../components/ShortcutMapOverlay';
import { CategoryGrid } from '../components/CategoryGrid';
import { ProductFormModal } from '../components/ProductFormModal';
import { PosItem, PosCategory } from '../data/mockData';
import {
  Zap, Search, Plus, Trash2, ArrowLeft, Printer, ShoppingCart,
  Keyboard, X, Package, Calculator, Barcode, Volume2, VolumeX,
  ChevronUp, ChevronDown, RotateCcw, CreditCard, Banknote, Percent,
  ArrowRight, ArrowUp, ArrowDown, ArrowLeftIcon, CheckCircle,
  Minus, ScanLine, ChevronRight, Receipt, Sparkles, User, Building2
} from 'lucide-react';
import { toast } from 'react-toastify';

interface QuickInvoiceItem extends InvoiceItem {
  originalPrice: number;
  productNameSi?: string;
  cost?: number;
  lastPrice?: number;
  salesPrice?: number;
  displayPrice?: number;
  ourPrice?: number;
  storeQty?: number;
}

// Step configuration for Quick Checkout
type QuickCheckoutStep = 'products' | 'review';
const STEPS: { key: QuickCheckoutStep; labelKey: string }[] = [
  { key: 'products', labelKey: 'invoice.stepProducts' },
  { key: 'review', labelKey: 'invoice.stepReview' },
];

// Keyboard shortcut hints
const SHORTCUTS = {
  search: 'F2',
  quantity: 'F3',
  cart: 'F4',
  payment: 'F5',
  discount: 'F6',
  addItem: 'Enter',
  removeLastItem: 'Delete',
  checkout: 'F12',
  clear: 'Escape',
};

// Mode-specific shortcuts
const QUANTITY_SHORTCUTS = {
  increase: '→',
  decrease: '←',
};

const CART_SHORTCUTS = {
  navUp: '↑',
  navDown: '↓',
  increaseQty: '→',
  decreaseQty: '←',
};

// Import concurrency-safe invoice number generator
import { generateNextInvoiceNumberSync, initializeFromExistingInvoices } from '../lib/invoiceNumberService';

// ── Inline quantity control helpers (for search & category popup rows) ──
// getItemCartQuantity: returns the current quantity of a product in the cart, or 0 if not present
const getItemCartQuantity = (items: QuickInvoiceItem[], productId: string): number => {
  const found = items.find(i => i.productId === productId);
  return found ? found.quantity : 0;
};

// Initialize invoice counter from existing data on module load
initializeFromExistingInvoices(mockInvoices);

export const QuickCheckout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();
  const currentLanguage = (i18n.language || '').toLowerCase();
  const isSinhala = currentLanguage === 'si' || currentLanguage === 'sinhala';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  
  const { categories, inventoryItems, addInventoryItem, refreshCategories, updateInventoryItem } = useCatalog();
  
  // Derive flattenedProducts from mockProducts once for legacy product catalog
  const [products] = useState<Product[]>(() => mockProducts);
  const flattenedProducts = useMemo(() => flattenProducts(products), [products]);
  
  // Build a live search index from inventoryItems for newly added products
  const inventorySearchIndex = useMemo(() => {
    const idx = new Map<string, InventoryProduct>();
    inventoryItems.forEach(item => {
      const key = item.searchKey.toLowerCase().trim();
      if (key) idx.set(key, item);
      const nameKey = item.name.toLowerCase().trim();
      if (nameKey) idx.set(nameKey, item);
    });
    return idx;
  }, [inventoryItems]);
  // ── Conditional inline-edit tracking state ──
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'salesPrice' | 'quantity' } | null>(null);
  const inlineEditInputRef = useRef<HTMLInputElement>(null);
  const [inlineEditStr, setInlineEditStr] = useState<string>('');

  // Focus and select all when entering inline edit mode
  useEffect(() => {
    if (editingCell && inlineEditInputRef.current) {
      inlineEditInputRef.current.focus();
      inlineEditInputRef.current.select();
    }
  }, [editingCell]);

  // ── In-place Edit mode via query param ──
  const editInvoiceId = searchParams.get('edit');
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [editingInvoiceLoading, setEditingInvoiceLoading] = useState(false);

  // Fetch the invoice from the backend API when edit mode is active
  // This uses the backend's flexible resolver that handles both UUID and invoiceNumber
  useEffect(() => {
    if (!editInvoiceId) {
      setEditingInvoice(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setEditingInvoiceLoading(true);
      try {
        const response = await api.get<any>(`/invoices/${encodeURIComponent(editInvoiceId)}`);
        if (!cancelled) {
          setEditingInvoice(response?.data ?? response);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('[QuickCheckout] Invoice not found for editing — starting fresh:', editInvoiceId, err);
          toast.info(
            `Invoice "${editInvoiceId}" not found. Starting with a fresh checkout.`,
            { autoClose: 4000 }
          );
          setEditingInvoice(null);

          navigate(window.location.pathname, { replace: true });
        }
      } finally {
        if (!cancelled) setEditingInvoiceLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [editInvoiceId, navigate]);

  // ── Hydrate state when editing an existing invoice ──
  useEffect(() => {
    if (!editingInvoice) return;

    // Map invoice items → QuickInvoiceItem, preserving all pricing fields
    const hydratedItems: QuickInvoiceItem[] = editingInvoice.items.map((item: any) => {
      const ourPrice   = Number(item.unitPrice || 0);
      const dispPrice  = Number(item.originalPrice || item.unitPrice || 0);
      const costPrice  = Number(item.cost || 0);
      const lastPrice  = Number(item.lastPrice || dispPrice);

      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productNameSi: item.productNameSi || item.productName,
        variantId: item.variantId,
        size: item.size,
        quantity: item.quantity,
        unitPrice: ourPrice,
        originalPrice: dispPrice,
        displayPrice: dispPrice,
        ourPrice: ourPrice,
        cost: costPrice,
        salesPrice: ourPrice,
        lastPrice: lastPrice,
        total: ourPrice * item.quantity,
      };
    });
    setItems(hydratedItems);

    // Populate customer
    if (editingInvoice.customerId && editingInvoice.customerId !== 'walk-in') {
      setSelectedCustomerId(editingInvoice.customerId);
      const found = customers.find((c: any) => c.id === editingInvoice.customerId);
      setCustomerSearch(found?.name || editingInvoice.customerName || '');
    } else {
      setSelectedCustomerId('walk-in');
      setCustomerSearch('');
    }

    // Populate financial fields
    const invoiceDiscount = editingInvoice.discountValue || editingInvoice.discount || 0;
    setDiscount(invoiceDiscount);
    setReceivedAmount(editingInvoice.receivedAmount || 0);

    // Map payment method (cash/credit are the two options in QuickCheckout)
    if (editingInvoice.paymentMethod === 'cash' || editingInvoice.paymentMethod === 'credit') {
      setPaymentMethod(editingInvoice.paymentMethod);
    }

    // Toast notification
    toast.info(`Editing invoice ${editingInvoice.invoiceNumber}. ${hydratedItems.length} items loaded.`);
  }, [editingInvoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const [items, setItems] = useState<QuickInvoiceItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [quantityStr, setQuantityStr] = useState<string>("1");
  const [discount, setDiscount] = useState<number>(0);
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState<number>(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showShortcutMap, setShowShortcutMap] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [pendingProduct, setPendingProduct] = useState<FlattenedProduct | null>(null);
  // ── TRIPLE CHECKBOX FILTER STATES ──
  // searchByKey:     match against product.searchKey  (default ON)
  // searchBarcode:   match against product.barcode    (default ON — must be strictly true by default)
  // searchByName:    match against product.name       (default OFF)
  const [searchByKey,    setSearchByKey]    = useState<boolean>(true);
  const [searchBarcode,  setSearchBarcode]  = useState<boolean>(true);
  const [searchByName,   setSearchByName]   = useState<boolean>(false);

  // ── SEARCH DROPDOWN QUANTITY SYNC STATE (ArrowRight/ArrowLeft in search results) ──
  const [searchDropdownQty, setSearchDropdownQty] = useState<number>(0);
  const [searchDropdownQtyStr, setSearchDropdownQtyStr] = useState<string>("0");

  // Stepped navigation state
  const [currentStep, setCurrentStep] = useState<QuickCheckoutStep>('products');
  const [currentMode, setCurrentMode] = useState<CheckoutMode>('search');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isQuantityFocused, setIsQuantityFocused] = useState(false);

  const applyInstantStockSync = useCallback((soldItems: QuickInvoiceItem[]) => {
    const stockDeltaById = new Map<string, number>();

    soldItems.forEach((item) => {
      const rawProductId = String(item.productId || '').trim();
      if (!rawProductId || rawProductId.startsWith('custom') || rawProductId === 'quick-add') return;

      const normalizedProductId = rawProductId.includes('__') ? rawProductId.split('__')[0] : rawProductId;
      const quantity = Number(item.quantity || 0);
      if (!normalizedProductId || !quantity) return;

      stockDeltaById.set(normalizedProductId, (stockDeltaById.get(normalizedProductId) || 0) + quantity);
    });

    stockDeltaById.forEach((quantity, productId) => {
      const currentProduct = inventoryItems.find((item) => item.id === productId);
      if (!currentProduct) return;

      updateInventoryItem(productId, {
        storeQty: Math.max(0, Number(currentProduct.storeQty || 0) - quantity),
      });
    });
  }, [inventoryItems, updateInventoryItem]);
  
  // Mobile-specific state
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  
  // Refs for keyboard navigation
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const productListRef = useRef<HTMLDivElement>(null);
  const cartListRef = useRef<HTMLDivElement>(null);
  const cartItemsContainerRef = useRef<HTMLDivElement>(null);
  
  // Refs for scroll synchronization - stores refs to individual items
  const cartItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const productItemRefs = useRef<Map<number, HTMLElement>>(new Map());
  
  // Quick Add row refs and state
  const quickAddNameRef = useRef<HTMLInputElement>(null);
  const quickAddPriceRef = useRef<HTMLInputElement>(null);
  const quickAddDisplayPriceRef = useRef<HTMLInputElement>(null);
  const quickAddQtyRef = useRef<HTMLInputElement>(null);
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  const [quickAddFocusField, setQuickAddFocusField] = useState<'name' | 'price' | 'displayPrice' | 'qty'>('name');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPrice, setQuickAddPrice] = useState<number>(0);
  const [quickAddDisplayPrice, setQuickAddDisplayPrice] = useState<number>(0);
  const [quickAddQty, setQuickAddQty] = useState<number>(1);
  
  const [showProductFormModal, setShowProductFormModal] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);
  const [activeMainSearchIndex, setActiveMainSearchIndex] = useState<number>(-1);
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1);
  const [isCartFocused, setIsCartFocused] = useState(false);
  const [isPaymentFocused, setIsPaymentFocused] = useState(false);

  // ── Categories from CatalogContext (live, database-backed) ──
  // Strict: showInQuickInvoice must be true AND sortOrder must be > 0
  // Sorted numerically by sortOrder ascending
  const quickCheckoutCategories = useMemo(() => {
    return categories
      .filter(c => c.showInQuickInvoice && c.sortOrder > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories]);

  const getCategoryDisplayName = useCallback((category?: { name?: string; nameSinhala?: string } | null, fallbackName?: string) => {
    const sinhalaName = category?.nameSinhala?.trim();
    const englishName = category?.name?.trim() || fallbackName?.trim() || '';
    if (isSinhala && sinhalaName) return sinhalaName;
    return englishName;
  }, [isSinhala]);

  // ── Category Popover State ──
  const [activeCategoryPopover, setActiveCategoryPopover] = useState<string | null>(null);
  const [categoryPopoverFilter, setCategoryPopoverFilter] = useState('');
  const [categoryPopoverAnchor, setCategoryPopoverAnchor] = useState<DOMRect | null>(null);
  const categoryPopoverRef = useRef<HTMLDivElement>(null);
  const categoryPopoverInputRef = useRef<HTMLInputElement>(null);

  // ── Category Popover Keyboard Navigation State ──
  const [activeCategoryItemIndex, setActiveCategoryItemIndex] = useState<number>(0);
  const [quantityPromptProduct, setQuantityPromptProduct] = useState<any | null>(null);
  const [categoryPromptQty, setCategoryPromptQty] = useState<string>("1");
  const categoryListContainerRef = useRef<HTMLDivElement>(null);
  
  // ── Display Settings Modal ──
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);

  // Memoized map of category → products for the Quick Categories grid
  const categoryProductMap = useMemo(() => {
    const map = new Map<string, typeof inventoryItems>();
    inventoryItems.forEach(item => {
      if (item.productCategory) {
        const existing = map.get(item.productCategory);
        if (existing) {
          existing.push(item);
        } else {
          map.set(item.productCategory, [item]);
        }
      }
    });
    return map;
  }, [inventoryItems]);

  const quickCategoryByName = useMemo(() => {
    const map = new Map<string, (typeof quickCheckoutCategories)[number]>();
    quickCheckoutCategories.forEach((cat) => map.set(cat.name, cat));
    return map;
  }, [quickCheckoutCategories]);

  const activeCategoryEntity = useMemo(() => {
    if (!activeCategoryPopover) return null;
    return quickCategoryByName.get(activeCategoryPopover) || null;
  }, [activeCategoryPopover, quickCategoryByName]);

  // ── Customer dropdown outside-click ref ──
  const customerContainerRef = useRef<HTMLDivElement>(null);

  // ── Outside-click listener for customer dropdown ──
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (customerContainerRef.current && !customerContainerRef.current.contains(event.target as Node)) {
        setCustomerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // ── API-driven Customer Directory ──
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  // Load customer directory from backend on mount (Auto-select walk-in)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCustomersLoading(true);
      try {
        const data = await api.get<any>('/customers', { perPage: 100 });
        if (!cancelled) {
          const list = Array.isArray(data) ? data : ((data as any)?.data ?? []);
          setCustomers(list);
        }
      } catch {
        // silently fall back to empty directory
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const findCustomerById = useCallback((id: string) => customers.find((c: any) => c.id === id) ?? null, [customers]);

  // Customer selection state — walk-in is default on mount
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const filteredCustomers = useMemo(
    () => customerSearch.trim()
      ? customers.filter((c: any) => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
      : customers,
    [customers, customerSearch],
  );

  // ── Inline new-customer registration modal with API POST ──
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName,    setNewCustName]    = useState('');
  const [newCustPhone,   setNewCustPhone]   = useState('');
  const [newCustEmail,   setNewCustEmail]   = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // ── ADD BOX live-search filter ──
  const [addCategorySearch, setAddCategorySearch] = useState('');
  const [addBoxAnchor, setAddBoxAnchor] = useState<DOMRect | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // STRICT 2-DECIMAL PRECISION HELPER
  // Uses Number(value.toFixed(2)) for robust nearest-neighbor rounding:
  //   1.33333... → 1.33    1.66666... → 1.67
  // ═══════════════════════════════════════════════════════════════════════════
  const toTwoDecimals = useCallback((value: number): number => {
    return Number(value.toFixed(2));
  }, []);

  // Helper functions for decimal-preserving quantity adjustments (rely on numeric quantity)
  const incrementQuantity = useCallback((currentQty: number): number => {
    const intPart = Math.floor(currentQty);
    const decimalPart = currentQty - intPart;
    return toTwoDecimals(intPart + 1 + decimalPart);
  }, [toTwoDecimals]);

  const decrementQuantity = useCallback((currentQty: number, minValue: number = 0.01): number => {
    const intPart = Math.floor(currentQty);
    const decimalPart = currentQty - intPart;
    const newIntPart = Math.max(0, intPart - 1);
    const newQty = newIntPart + decimalPart;
    return Math.max(minValue, newQty > 0 ? newQty : decimalPart > 0 ? toTwoDecimals(decimalPart) : minValue);
  }, [toTwoDecimals]);

  // Play beep sound for feedback
  const playBeep = useCallback((type: 'add' | 'remove' | 'error' | 'success') => {
    if (!soundEnabled) return;
    
    const frequencies: Record<string, number> = {
      add: 800,
      remove: 400,
      error: 200,
      success: 1000,
    };
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequencies[type];
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Audio not supported
    }
  }, [soundEnabled]);

  // ── STRICT parseScanInput: only matches barcode-like scan sequences ──
  // This function must NOT match natural product names containing 'x' or 'X'.
  // The code part before/after the separator must be alphanumeric only (no spaces, slashes)
  // to prevent false matches on names like "1/2X1/2 GI BOX".
  // Additionally, the code portion must be at least 3 characters long to prevent false
  // matches on input like "1X1" or "2X3" that are part of a product name being typed.
  const parseScanInput = (input: string): { code?: string; qty?: number } | null => {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Prefix pattern: <digits> <separator> <clean-code>
    // e.g. "2*BARCODE" or "3XCODE123"
    // Code part must be at least 3 chars to avoid matching product names like "1X1"
    const prefix = trimmed.match(/^\s*(\d+)\s*[\*xX\|\-]\s*([A-Za-z0-9_-]{3,})\s*$/);
    if (prefix) {
      const qty = Number(prefix[1]);
      const code = prefix[2].trim();
      if (code && qty > 0) return { qty, code };
    }

    // Suffix pattern: <clean-code> <separator> <digits>
    // e.g. "BARCODE*2" or "CODE-X-5"
    // Code part must be at least 3 chars to avoid product name collisions
    const suffix = trimmed.match(/^\s*([A-Za-z0-9_-]{3,})\s*[\*xX\|\-]\s*(\d+)\s*$/);
    if (suffix) {
      const code = suffix[1].trim();
      const qty = Number(suffix[2]);
      if (code && qty > 0) return { qty, code };
    }

    // Plain barcode (all digits or alphanumeric without spaces/slashes)
    // Must be at least 3 characters to avoid matching single characters typed in search
    const plain = trimmed.match(/^[A-Za-z0-9_]{3,}$/);
    if (plain) return { code: trimmed };

    return null;
  };

  // ── Search inventoryItems directly from live CatalogContext ──
  const filteredProducts = useMemo((): any[] => {
    if (!productSearch.trim()) return [];

    const raw = productSearch.trim();
    const normalizedQuery = raw.toLowerCase();

    // ── Priority 1: exact barcode match — single result ──
    // Only triggers if Barcode checkbox is active
    if (searchBarcode) {
      const barcodeHit = inventoryItems.find(
        item => item.barcode && item.barcode.trim() === raw
      );
      if (barcodeHit) {
        const sinhalaName = barcodeHit.nameSinhala || barcodeHit.nameSi || barcodeHit.name;
        return [{
          flatId: barcodeHit.id,
          product: { nameAlt: sinhalaName, sku: barcodeHit.searchKey, category: barcodeHit.productCategory } as any,
          variant: undefined,
          displayName: barcodeHit.name,
          displaySku: barcodeHit.searchKey,
          displayBarcode: barcodeHit.barcode,
          costPrice:    barcodeHit.cost,
          wholesalePrice: barcodeHit.displayPrice,
          retailPrice:  barcodeHit.salesPrice,
          discountedPrice: undefined,
          hasDiscount: false,
          stock: barcodeHit.storeQty,
          minStock: 0,
          isVariant: false,
          variantLabel: undefined,
        }];
      }
    }

    // ── Priority 2: scope-aware tiered text search ──
    const strippedQuery = normalizedQuery.replace(/\s+/g, '');
    const queryTokens   = normalizedQuery.split(/\s+/).filter(Boolean);

    const toFlat = (item: typeof inventoryItems[0]) => {
      const sinhalaName = item.nameSinhala || item.nameSi || item.name;
      return {
      flatId: item.id,
      product: { nameAlt: sinhalaName, sku: item.searchKey, category: item.productCategory } as any,
      variant: undefined,
      displayName: item.name,
      displaySku: item.searchKey,
      displayBarcode: item.barcode || item.searchKey,
      costPrice:    item.cost,
      wholesalePrice: item.displayPrice,
      retailPrice:  item.salesPrice,
      discountedPrice: undefined,
      hasDiscount: false,
      stock: item.storeQty,
      minStock: 0,
      isVariant: false,
      variantLabel: undefined,
      };
    };

    const scoreField = (fieldRaw: string): 0 | 1 | 2 => {
      if (!fieldRaw) return 0;
      const field         = fieldRaw.toLowerCase();
      const strippedField = field.replace(/\s+/g, '');
      const fieldTokens   = field.split(/\s+/).filter(Boolean);

      if (strippedField === strippedQuery) return 2;
      if (
        queryTokens.length === fieldTokens.length &&
        queryTokens.every((tok, i) => tok === fieldTokens[i])
      ) return 2;
      if (strippedQuery.length > 0 && strippedField.includes(strippedQuery)) return 1;
      return 0;
    };

    const scored: Array<{ item: typeof inventoryItems[0]; score: number }> = [];
    for (const item of inventoryItems) {
      let score = 0;
      // Conditionally score each field based on which checkboxes are active (OR logic)
      if (searchByKey)   score = Math.max(score, scoreField(item.searchKey || ''));
      if (searchBarcode) score = Math.max(score, scoreField(item.barcode || ''));
      if (searchByName)  score = Math.max(score, scoreField(item.name || ''));
      if (score > 0) scored.push({ item, score });
    }

    const hasExact = scored.some(s => s.score === 2);
    const filtered = hasExact
      ? scored.filter(s => s.score === 2)
      : scored;

    filtered.sort((a, b) => b.score - a.score);
    return filtered.map(s => toFlat(s.item));
  }, [inventoryItems, productSearch, searchByKey, searchBarcode, searchByName]);

  // Auto-detect barcode scan / direct paste (when field gains input)
  useEffect(() => {
    if (filteredProducts.length === 1 && productSearch.length >= 2) {
      const flatProduct = filteredProducts[0];
      const isExactMatch =
        flatProduct.displayBarcode === productSearch ||
        flatProduct.displaySku.toLowerCase() === productSearch.toLowerCase() ||
        flatProduct.product.sku.toLowerCase() === productSearch.toLowerCase();

      if (isExactMatch) {
        setPendingProduct(flatProduct);
        setProductSearch('');
        setSelectedProductIndex(-1);
        setQuantity(1);
        setQuantityStr("1");
        setIsQuantityFocused(true);
        setTimeout(() => {
          quantityInputRef.current?.focus();
          quantityInputRef.current?.select();
        }, 50);
        playBeep('add');
        toast.info(`${flatProduct.displayName} - ${t('quickCheckout.enterQuantity')}`);
      }
    }
  }, [filteredProducts, productSearch, playBeep, t]);

  const parseQuantityInput = useCallback((input: string): number => {
    const trimmed = input.trim();
    if (!trimmed.length) return NaN;
    if (trimmed.startsWith('.')) {
      return parseFloat('0' + trimmed);
    }
    const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fractionMatch) {
      const num = parseInt(fractionMatch[1], 10);
      const den = parseInt(fractionMatch[2], 10);
      if (den > 0) return num / den;
    }
    const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1], 10);
      const num = parseInt(mixedMatch[2], 10);
      const den = parseInt(mixedMatch[3], 10);
      if (den > 0) return whole + num / den;
    }
    return parseFloat(trimmed);
  }, []);

  const getCartQuantity = useCallback((overrideQty?: number): number => {
    const raw = overrideQty !== undefined ? String(overrideQty) : quantityStr;
    const parsed = parseQuantityInput(raw);
    if (isNaN(parsed) || parsed <= 0) return 0.001;
    return toTwoDecimals(parsed);
  }, [quantityStr, parseQuantityInput, toTwoDecimals]);

  const syncQuantityFromStr = useCallback(() => {
    const parsed = parseQuantityInput(quantityStr);
    if (!isNaN(parsed) && parsed > 0) {
      setQuantity(toTwoDecimals(parsed));
    }
  }, [quantityStr, parseQuantityInput, toTwoDecimals]);

  const addProductToCart = useCallback((flatProduct: FlattenedProduct, overrideQty?: number) => {
    const addQty = getCartQuantity(overrideQty);

    const masterProduct = inventoryItems.find(
      inv => inv.id === flatProduct.flatId
    );
    const ourPriceVal     = Number(masterProduct?.salesPrice   ?? flatProduct.retailPrice    ?? 0);
    const displayPriceVal = Number(masterProduct?.displayPrice ?? flatProduct.wholesalePrice ?? 0);
    const costVal         = Number(masterProduct?.cost         ?? flatProduct.costPrice      ?? 0);
    const lastPriceVal    = Number(masterProduct?.lastPrice    ?? 0);
    const storeQtyVal     = Number(masterProduct?.storeQty     ?? flatProduct.stock          ?? 0);

    const existingItem = items.find((i) => i.productId === flatProduct.flatId);
    if (existingItem) {
      if (existingItem.quantity + addQty > storeQtyVal) {
        playBeep('error');
        toast.error(`${t('quickCheckout.insufficientStock')}: ${storeQtyVal} ${t('invoice.available')}`);
        return;
      }
      setItems(
        items.map((i) =>
          i.productId === flatProduct.flatId
            ? { ...i, quantity: i.quantity + addQty, total: (i.quantity + addQty) * ourPriceVal }
            : i
        )
      );
    } else {
      if (addQty > storeQtyVal) {
        playBeep('error');
        toast.error(`${t('quickCheckout.insufficientStock')}: ${storeQtyVal} ${t('invoice.available')}`);
        return;
      }
      const newItem: QuickInvoiceItem = {
        id:            `item-${Date.now()}`,
        productId:     flatProduct.flatId,
        productName:   flatProduct.displayName,
        productNameSi: flatProduct.product.nameAlt || flatProduct.displayName,
        variantId:     flatProduct.variant?.id,
        size:          flatProduct.variant?.size,
        quantity:      addQty,
        unitPrice:     ourPriceVal,
        originalPrice: displayPriceVal,
        total:         addQty * ourPriceVal,
        cost:          costVal,
        lastPrice:     lastPriceVal,
        salesPrice:    ourPriceVal,
        displayPrice:  displayPriceVal,
        ourPrice:      ourPriceVal,
        storeQty:      storeQtyVal,
      };
      setItems([...items, newItem]);
    }

    playBeep('add');
    setQuantity(1);
    setQuantityStr("1");
    searchInputRef.current?.focus();

    setTimeout(() => {
      if (cartItemsContainerRef.current) {
        cartItemsContainerRef.current.scrollTop = cartItemsContainerRef.current.scrollHeight;
      }
    }, 50);
  }, [items, inventoryItems, getCartQuantity, playBeep, t]);

  const findExactMatch = useCallback((input: string): FlattenedProduct | undefined => {
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    const lower = trimmed.toLowerCase();
    return flattenedProducts.find(
      (fp) =>
        fp.displayBarcode === trimmed ||
        fp.displaySku.toLowerCase() === lower ||
        fp.product.sku.toLowerCase() === lower
    );
  }, [flattenedProducts]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted || pasted.length < 2) return;

    const match = findExactMatch(pasted);
    if (match && match.stock > 0) {
      e.preventDefault();
      addProductToCart(match, 1);
      setProductSearch('');
      toast.success(`${match.displayName} ${t('quickCheckout.addedToCart')}`, { autoClose: 1500 });
      playBeep('add');
    }
  }, [findExactMatch, addProductToCart, playBeep, t]);

  const handleBarcodeScanDispatch = useCallback((scannedValue: string): boolean => {
    const trimmed = scannedValue.trim();
    if (!trimmed || trimmed.length < 4) return false;

    const foundProduct = inventoryItems.find(
      p => p.barcode && p.barcode.trim() === trimmed
    );
    if (!foundProduct) return false;

    const sinhalaName = foundProduct.nameSinhala || foundProduct.nameSi || foundProduct.name;
    const fp: FlattenedProduct = {
      flatId: foundProduct.id,
      product: { nameAlt: sinhalaName, sku: foundProduct.searchKey, category: foundProduct.productCategory } as any,
      variant: undefined,
      displayName: foundProduct.name,
      displaySku: foundProduct.searchKey,
      displayBarcode: foundProduct.barcode,
      costPrice:      foundProduct.cost,
      wholesalePrice: foundProduct.displayPrice,
      retailPrice:    foundProduct.salesPrice,
      discountedPrice: undefined,
      hasDiscount: false,
      stock: foundProduct.storeQty,
      minStock: 0,
      isVariant: false,
      variantLabel: undefined,
    } as FlattenedProduct;

    setPendingProduct(fp);
    setProductSearch(foundProduct.name);
    setQuantity(1);
    setQuantityStr("1");
    setSelectedProductIndex(-1);
    playBeep('add');
    toast.info(`${foundProduct.name} — ${t('quickCheckout.enterQuantity')}`, { autoClose: 2000 });

    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 30);

    return true;
  }, [inventoryItems, playBeep, t]);

  const removeItem = useCallback((itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId));
    playBeep('remove');
  }, [items, playBeep]);

  const applyDiscountToAll = useCallback((percent: number) => {
    if (items.length === 0) {
      toast.error(t('invoice.noItemsYet'));
      return;
    }
    if (percent <= 0 || percent > 100) {
      toast.error(t('invoice.enterDiscountPercent'));
      return;
    }
    
    setItems(items.map(item => {
      const discountedPrice = Math.round(item.originalPrice * (1 - percent / 100));
      return {
        ...item,
        unitPrice: discountedPrice,
        total: item.quantity * discountedPrice,
      };
    }));
    
    toast.success(`${percent}% ${t('invoice.discountApplied')}`);
    setBulkDiscountPercent(0);
    playBeep('add');
  }, [items, t, playBeep]);

  // Lightweight direct state setter — NO validation, NO toast
  const setCartItemPrice = useCallback((itemId: string, newPrice: number) => {
    const sanitizedPrice = Number(newPrice || 0);
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId
          ? { 
              ...item, 
              salesPrice: sanitizedPrice, 
              ourPrice: sanitizedPrice,
              unitPrice: sanitizedPrice,
              total: sanitizedPrice * item.quantity,
            }
          : item
      )
    );
  }, []);

  // Silent live state update — NO validation during keystroke typing
  const handleUpdateCartItemPrice = useCallback((itemId: string, newPrice: number) => {
    setCartItemPrice(itemId, newPrice);
  }, [setCartItemPrice]);

  // Commit-time deferred price validation + auto-correction — fires ONLY on Enter or Blur
  const commitCartItemPrice = useCallback((itemId: string) => {
    const targetItem = items.find(i => i.id === itemId);
    if (!targetItem) {
      setEditingCell(null);
      return;
    }

    const lastPriceThreshold = Number(targetItem.lastPrice ?? 0);
    const sanitizedPrice = parseFloat(inlineEditStr);

    if (isNaN(sanitizedPrice) || sanitizedPrice < 0) {
      // Invalid input — reset to last valid price
      const resetPrice = Number(targetItem.salesPrice || targetItem.ourPrice || 0);
      setInlineEditStr(String(resetPrice));
      setEditingCell(null);
      return;
    }

    // Apply the typed value silently first (it may have been partially typed)
    setCartItemPrice(itemId, sanitizedPrice);

    if (lastPriceThreshold > 0 && sanitizedPrice < lastPriceThreshold) {
      // Auto-correct: reset to lastPrice threshold
      playBeep('error');
      toast.error(
        `Price cannot drop below the last-price threshold: Rs. ${lastPriceThreshold.toFixed(2)}. Auto-corrected to threshold.`,
        { autoClose: 4000 }
      );
      setCartItemPrice(itemId, lastPriceThreshold);
      setInlineEditStr(String(lastPriceThreshold));
    }

    setEditingCell(null);
  }, [items, inlineEditStr, playBeep, toast, setCartItemPrice]);

  const updateItemQuantity = useCallback((itemId: string, newQuantity: number) => {
    const roundedQty = toTwoDecimals(newQuantity);
    if (roundedQty <= 0) {
      removeItem(itemId);
      return;
    }
    
    const item = items.find((i) => i.id === itemId);
    if (item) {
      const flatProduct = flattenedProducts.find((fp) => fp.flatId === item.productId);
      if (flatProduct && roundedQty > flatProduct.stock) {
        playBeep('error');
        toast.error(`${t('quickCheckout.insufficientStock')}: ${flatProduct.stock} ${t('invoice.available')}`);
        return;
      }
    }
    
    setItems(items.map(i => 
      i.id === itemId 
        ? { ...i, quantity: roundedQty, total: roundedQty * Number(i.salesPrice || i.ourPrice || i.unitPrice) }
        : i
    ));
  }, [items, flattenedProducts, removeItem, playBeep, t, toTwoDecimals]);

  const handleTouchStart = useCallback((e: React.TouchEvent, itemId: string) => {
    setTouchStartX(e.touches[0].clientX);
    setSwipedItemId(itemId);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipedItemId) return;
    const delta = e.touches[0].clientX - touchStartX;
    setTouchDeltaX(Math.max(-100, Math.min(100, delta)));
  }, [swipedItemId, touchStartX]);

  const handleTouchEnd = useCallback(() => {
    if (Math.abs(touchDeltaX) > 60) {
      const item = items.find(i => i.id === swipedItemId);
      if (item) {
        if (touchDeltaX < -60) {
          removeItem(item.id);
          toast.success(t('quickCheckout.itemRemoved'));
        } else if (touchDeltaX > 60) {
          updateItemQuantity(item.id, item.quantity + 1);
        }
      }
    }
    setTouchDeltaX(0);
    setSwipedItemId(null);
  }, [touchDeltaX, swipedItemId, items, removeItem, updateItemQuantity, t]);

  const quickAddProduct = useCallback((flatProduct: FlattenedProduct) => {
    addProductToCart(flatProduct, 1);
    if (isMobile) {
      toast.success(`${flatProduct.displayName} ${t('quickCheckout.addedToCart')}`, { autoClose: 1500 });
    }
  }, [addProductToCart, isMobile, t]);

  const [quickAddPriceStr, setQuickAddPriceStr] = useState<string>('');
  const [quickAddDisplayPriceStr, setQuickAddDisplayPriceStr] = useState<string>('');
  const [quickAddQtyStr, setQuickAddQtyStr] = useState<string>('1');

  const addQuickAddItem = useCallback(() => {
    const rawQty = parseQuantityInput(quickAddQtyStr);
    const qtyParsed = toTwoDecimals(rawQty);
    const salesPriceParsed = parseQuantityInput(quickAddPriceStr);
    const displayPriceParsed = quickAddDisplayPriceStr.trim()
      ? parseQuantityInput(quickAddDisplayPriceStr)
      : salesPriceParsed;
    
    if (!quickAddName.trim() || isNaN(salesPriceParsed) || salesPriceParsed <= 0 || isNaN(qtyParsed) || qtyParsed <= 0 || isNaN(displayPriceParsed) || displayPriceParsed <= 0) {
      playBeep('error');
      toast.error(t('quickCheckout.quickAddValidation'));
      return;
    }
    
    const newItem: QuickInvoiceItem = {
      id: `custom-${Date.now()}`,
      productId: `custom-${Date.now()}`,
      productName: quickAddName.trim(),
      quantity: qtyParsed,
      unitPrice: salesPriceParsed,
      originalPrice: displayPriceParsed,
      salesPrice: salesPriceParsed,
      ourPrice: salesPriceParsed,
      displayPrice: displayPriceParsed,
      total: qtyParsed * salesPriceParsed,
    };
    
    setItems(prev => [...prev, newItem]);
    playBeep('add');
    toast.success(`${quickAddName} × ${qtyParsed} ${t('quickCheckout.addedToCart')}`);
    
    setQuickAddName('');
    setQuickAddPrice(0);
    setQuickAddDisplayPrice(0);
    setQuickAddQty(1);
    setQuickAddPriceStr('');
    setQuickAddDisplayPriceStr('');
    setQuickAddQtyStr('1');
    setIsQuickAddMode(false);
    setQuickAddFocusField('name');
    searchInputRef.current?.focus();
    
    setTimeout(() => {
      if (cartItemsContainerRef.current) {
        cartItemsContainerRef.current.scrollTop = cartItemsContainerRef.current.scrollHeight;
      }
    }, 50);
  }, [quickAddName, quickAddPriceStr, quickAddDisplayPriceStr, quickAddQtyStr, parseQuantityInput, toTwoDecimals, playBeep, t]);

  const computedSubtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.salesPrice || item.ourPrice || 0) * item.quantity), 0);
  }, [items]);

  const computedDiscount = Number(discount) || 0;
  const computedFinalTotal = Math.max(0, computedSubtotal - computedDiscount);

  const computedCustomerProfit = useMemo(() => {
    const priceGapSavings = items.reduce((acc, item) => {
      const display = Number(item.displayPrice || 0);
      const sales = Number(item.salesPrice || item.ourPrice || 0);
      return acc + ((display - sales) * item.quantity);
    }, 0);
    return priceGapSavings + (Number(discount) || 0);
  }, [items, discount]);

  const subtotal = items.reduce((sum, item) => sum + (Number(item.salesPrice || item.ourPrice || 0) * item.quantity), 0);

  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const receivedAmountInputRef = useRef<HTMLInputElement>(null);
  // Signed balance: positive = change (surplus), negative = deficit (amount still due)
  const changeAmount = receivedAmount > 0 ? Number((receivedAmount - computedFinalTotal).toFixed(2)) : 0;
  const isDeficit = receivedAmount > 0 && receivedAmount < computedFinalTotal;

  const clearCart = useCallback(() => {
    setItems([]);
    setProductSearch('');
    setQuantity(1);
    setQuantityStr("1");
    setDiscount(0);
    setReceivedAmount(0);
    setPendingProduct(null);
    setSelectedProductIndex(-1);
    searchInputRef.current?.focus();
  }, []);

  const finalizeSale = useCallback((invoiceNumber?: string) => {
    setItems([]);
    setDiscount(0);
    setReceivedAmount(0);
    setIsProcessing(false);
    searchInputRef.current?.focus();
    if (invoiceNumber) {
      toast.success(`${t('quickCheckout.saleCompleted')}: ${invoiceNumber}`);
    } else {
      toast.success(t('quickCheckout.saleCompleted'));
    }
  }, [t]);

  const handleCheckout = useCallback(async () => {
    if (items.length === 0 || isProcessing) return;
    
    // Check if we are handling a replacement modification instead of an entirely fresh sale
    if (editInvoiceId) {
      // BEYOND CRITICAL: In Edit Mode, Route the Checkout & Print F12 trigger into the PUT update service pipeline!
      setIsProcessing(true);
      try {
        const resolved = await api.get<any>(`/invoices/${editInvoiceId}`);
        const resolvedInvoice = resolved?.data ?? resolved;
        const dbUuid = resolvedInvoice?.id || editInvoiceId;
        
        const invoiceDiscount = Math.round(computedDiscount * 100) / 100;
        
        // Dispatch exact aligned payload structure via PUT to update instead of duplicating rows
        // ⚠️ CRITICAL: Use absolute array index position for item matching, NOT productId-based
        // lookups. This eliminates ALL hash collisions when multiple custom/temporary items
        // share productId: null. The backend update() now uses the same index-based protocol.
        const invoiceItems = items.map((item, index) => {
          // Index-based lookup: use the DB item at the same array index position
          const dbItemAtIndex = resolvedInvoice?.items?.[index];
          return {
            id: dbItemAtIndex?.id || item.id,
            productId: item.productId,
            productName: item.productName,
            productNameSi: item.productNameSi,
            quantity: item.quantity,
            unitPrice: Number(item.salesPrice || item.ourPrice || item.unitPrice),
            originalPrice: Number(item.displayPrice || item.originalPrice || item.unitPrice),
            total: Number(item.salesPrice || item.ourPrice || item.unitPrice) * item.quantity,
          };
        });
        
        const payloadData = {
          customerId: selectedCustomerId || 'walk-in',
          discount: invoiceDiscount,
          subtotal: Math.round(computedSubtotal * 100) / 100,
          total: Math.round(computedFinalTotal * 100) / 100,
          receivedAmount: receivedAmount > 0 ? Math.round(receivedAmount * 100) / 100 : undefined,
          changeAmount: changeAmount !== 0 ? Math.round(changeAmount * 100) / 100 : undefined,
          paymentMethod: paymentMethod,
          status: paymentMethod === 'credit' ? 'pending' : 'paid',
          notes: invoiceDiscount > 0 
            ? `${t('quickCheckout.quickSaleNote')} - ${t('quickCheckout.discount')}: ${t('common.currency')} ${invoiceDiscount.toLocaleString()}`
            : t('quickCheckout.quickSaleNote'),
          items: invoiceItems,
        };
        
        // Send PUT using the resolved internal UUID
        await api.put(`/invoices/${dbUuid}`, payloadData);
        
        playBeep('success');
        
        // Fire standard hardware template print logic right after
        const walkInCustomer: Customer = {
          id: 'walk-in',
          name: t('invoice.walkInCustomer'),
          email: '',
          phone: '',
          address: '',
          customerType: 'regular',
          loanBalance: 0,
        };
        const selectedCust = selectedCustomerId !== 'walk-in' ? findCustomerById(selectedCustomerId) : null;
        
        try {
          const savedInvoiceNumber = resolvedInvoice?.invoiceNumber || 'N/A';
          await printInvoice(
            {
              ...payloadData,
              id: dbUuid,
              invoiceNumber: savedInvoiceNumber,
              items: items as any,
              tax: 0,
            } as Invoice,
            selectedCust ?? walkInCustomer,
            isSinhala ? 'si' : 'en',
            currentUser?.name || 'Admin User',
          );
        } catch {
          toast.error(t('quickCheckout.printBlocked'));
        }
        
        toast.success(t('quickCheckout.invoiceUpdated'));
        clearCart();
        navigate('/invoices');
      } catch (err: any) {
        toast.error(err?.response?.data?.message || err?.message || 'Failed to update invoice');
        playBeep('error');
      } finally {
        setIsProcessing(false);
      }
      return; // Terminate execution thread here safely
    }
    
    setIsProcessing(true);
    
    const invoiceNumber = generateNextInvoiceNumberSync();
    const invoiceDiscount = Math.round(computedDiscount * 100) / 100;
    const invoiceItems = items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productNameSi: item.productNameSi,
      quantity: item.quantity,
      unitPrice: Number(item.salesPrice || item.ourPrice || item.unitPrice),
      originalPrice: Number(item.displayPrice || item.originalPrice || item.unitPrice),
      discount: item.discount ?? 0,
      total: Number(item.salesPrice || item.ourPrice || item.unitPrice) * item.quantity,
    }));
    
    const selectedCust = selectedCustomerId !== 'walk-in' ? findCustomerById(selectedCustomerId) : null;
    const customerName = selectedCust?.name ?? t('invoice.walkInCustomer');
    
    // Build payload matching backend InvoiceService.create input schema
    const payload = {
      customerId: selectedCustomerId || '',
      customerName,
      subtotal: Math.round(computedSubtotal * 100) / 100,
      discount: invoiceDiscount,
      total: Math.round(computedFinalTotal * 100) / 100,
      receivedAmount: receivedAmount > 0 ? Math.round(receivedAmount * 100) / 100 : undefined,
      changeAmount: changeAmount !== 0 ? Math.round(changeAmount * 100) / 100 : undefined,
      issueDate: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      paymentMethod,
      status: paymentMethod === 'credit' ? 'pending' : 'paid',
      notes: invoiceDiscount > 0 
        ? `${t('quickCheckout.quickSaleNote')} - ${t('quickCheckout.discount')}: ${t('common.currency')} ${invoiceDiscount.toLocaleString()}`
        : t('quickCheckout.quickSaleNote'),
      items: invoiceItems,
    };

    try {
      // 1. POST to backend — this is the actual database write
      const response: any = await api.post('/invoices', payload);
      const savedInvoice = response?.data ?? response;
      const savedInvoiceNumber = savedInvoice?.invoiceNumber || invoiceNumber;

      applyInstantStockSync(items);
      playBeep('success');

      // 2. Print receipt only after successful database write
      const walkInCustomer: Customer = {
        id: 'walk-in',
        name: t('invoice.walkInCustomer'),
        email: '',
        phone: '',
        address: '',
        customerType: 'regular',
        loanBalance: 0,
      };

      try {
        await printInvoice(
          {
            ...payload,
            id: savedInvoice?.id || `inv-${Date.now()}`,
            invoiceNumber: savedInvoiceNumber,
            items: items as any,
            tax: 0,
          } as Invoice,
          selectedCust ?? walkInCustomer,
          isSinhala ? 'si' : 'en',
          currentUser?.name || 'Admin User',
        );
      } catch {
        toast.error(t('quickCheckout.printBlocked'));
      }

      // 3. Clear UI state and show success ONLY after HTTP 201/200 confirmed
      finalizeSale(savedInvoiceNumber);

      // 4. If in edit mode, redirect to invoices list
      if (editInvoiceId) {
        navigate('/invoices');
      }
    } catch (err: any) {
      setIsProcessing(false);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save invoice');
      playBeep('error');
    }
  }, [items, computedSubtotal, computedFinalTotal, computedDiscount, selectedCustomerId, paymentMethod, playBeep, t, finalizeSale, receivedAmount, changeAmount, isSinhala, findCustomerById, editInvoiceId, navigate, applyInstantStockSync]);

  // ── Update existing invoice via PUT /api/invoices/:id ──
  const handleUpdateInvoice = useCallback(async () => {
    if (items.length === 0 || isProcessing || !editInvoiceId) return;
    
    setIsProcessing(true);
    
    try {
      // 1. Resolve the actual internal UUID from the backend by fetching
      //    the invoice first. The backend's getById handles both UUID and
      //    invoiceNumber lookup, returning the full record with the DB id.
      const resolved = await api.get<any>(`/invoices/${editInvoiceId}`);
      const resolvedInvoice = resolved?.data ?? resolved;
      const dbUuid = resolvedInvoice?.id || editInvoiceId;

      const invoiceDiscount = Math.round(computedDiscount * 100) / 100;

      // Hydrate item payload with database UUIDs from the resolved invoice.
      // ⚠️ CRITICAL: Use absolute array index position for item matching, NOT
      // productId-based lookups. This eliminates ALL hash collisions when multiple
      // custom/temporary items share productId: null. The backend update() now
      // uses the same index-based protocol for final alignment.
      const invoiceItems = items.map((item, index) => {
        // Index-based lookup: use the DB item at the same array index position
        const dbItemAtIndex = resolvedInvoice?.items?.[index];
        return {
          id: dbItemAtIndex?.id || item.id,
          productId: item.productId,
          productName: item.productName,
          productNameSi: item.productNameSi,
          quantity: item.quantity,
          unitPrice: Number(item.salesPrice || item.ourPrice || item.unitPrice),
          originalPrice: Number(item.displayPrice || item.originalPrice || item.unitPrice),
          total: Number(item.salesPrice || item.ourPrice || item.unitPrice) * item.quantity,
        };
      });
      
      const payloadData = {
        customerId: selectedCustomerId || 'walk-in',
        discount: invoiceDiscount,
        subtotal: Math.round(computedSubtotal * 100) / 100,
        total: Math.round(computedFinalTotal * 100) / 100,
        receivedAmount: receivedAmount > 0 ? Math.round(receivedAmount * 100) / 100 : undefined,
        changeAmount: changeAmount !== 0 ? Math.round(changeAmount * 100) / 100 : undefined,
        paymentMethod: paymentMethod,
        status: paymentMethod === 'credit' ? 'pending' : 'paid',
        notes: invoiceDiscount > 0 
          ? `${t('quickCheckout.quickSaleNote')} - ${t('quickCheckout.discount')}: ${t('common.currency')} ${invoiceDiscount.toLocaleString()}`
          : t('quickCheckout.quickSaleNote'),
        items: invoiceItems,
      };
      
      // 2. Send PUT using the resolved internal UUID to ensure the backend
      //    routes to the correct database record
      await api.put(`/invoices/${dbUuid}`, payloadData);
      
      playBeep('success');
      toast.success(t('quickCheckout.invoiceUpdated'));
      
      await refreshCategories();
      
      setItems([]);
      setDiscount(0);
      setReceivedAmount(0);
      
      navigate('/invoices');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update invoice');
    } finally {
      setIsProcessing(false);
    }
  }, [items, computedSubtotal, computedFinalTotal, computedDiscount, selectedCustomerId, paymentMethod, editInvoiceId, receivedAmount, changeAmount, playBeep, t, navigate, refreshCategories]);

  const handleQuickSave = useCallback(() => {
    if (items.length === 0 || isProcessing) return;
    
    setIsProcessing(true);
    
    const invoiceNumber = generateNextInvoiceNumberSync();
    const invoiceDiscount = Math.round(computedDiscount * 100) / 100;
    const invoiceItems = items.map(item => ({
      ...item,
      unitPrice: Number(item.salesPrice || item.ourPrice || item.unitPrice),
      total: Number(item.salesPrice || item.ourPrice || item.unitPrice) * item.quantity,
      displayPrice: Number(item.displayPrice || item.lastPrice || item.unitPrice),
      ourPrice: Number(item.salesPrice || item.ourPrice || item.unitPrice),
    }));
    
    const selectedCust = selectedCustomerId !== 'walk-in' ? findCustomerById(selectedCustomerId) : null;
    const customerName = selectedCust?.name ?? t('invoice.walkInCustomer');
    
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      customerId: selectedCustomerId || 'walk-in',
      customerName,
      items: invoiceItems,
      subtotal: Math.round(computedSubtotal * 100) / 100,
      tax: 0,
      discount: invoiceDiscount,
      total: Math.round(computedFinalTotal * 100) / 100,
      receivedAmount: receivedAmount > 0 ? Math.round(receivedAmount * 100) / 100 : undefined,
      changeAmount: changeAmount !== 0 ? Math.round(changeAmount * 100) / 100 : undefined,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      status: paymentMethod === 'credit' ? 'pending' : 'paid',
      paymentMethod: paymentMethod,
      notes: invoiceDiscount > 0 
        ? `${t('quickCheckout.quickSaleNote')} - ${t('quickCheckout.discount')}: ${t('common.currency')} ${invoiceDiscount.toLocaleString()}`
        : t('quickCheckout.quickSaleNote'),
    };

    playBeep('success');
    toast.success(
      `${t('quickCheckout.invoiceSaved')}: ${invoiceNumber}. ${t('common.currency')} ${invoice.total.toLocaleString()}`
    );
    
    setItems([]);
    setDiscount(0);
    setReceivedAmount(0);
    setIsProcessing(false);
    searchInputRef.current?.focus();
  }, [items, computedSubtotal, computedFinalTotal, computedDiscount, selectedCustomerId, paymentMethod, playBeep, t, isProcessing, receivedAmount, changeAmount, findCustomerById]);

  // Keyboard event handler (full, preserved as-is)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ── DEFEND FORM FIELDS: If user is actively typing in an input, textarea,
      //    or contentEditable block, DO NOT trigger cart removal on Delete/Backspace!
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow native text erasure for Backspace/Delete; skip all cart logic.
        if (e.key === 'Delete' || e.key === 'Backspace') {
          return; // Safe bypass — let native text erasure happen
        }
      }

      const isInSearchInput = document.activeElement === searchInputRef.current;
      const isInQuantityInput = document.activeElement === quantityInputRef.current;
      const isInDiscountInput = document.activeElement === discountInputRef.current;
      const isInReceivedInput = document.activeElement === receivedAmountInputRef.current;
      
      if (e.key === '?' && !isInSearchInput && !isInQuantityInput && !isInDiscountInput && !isInReceivedInput) {
        e.preventDefault();
        setShowShortcutMap(prev => !prev);
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStep === 'review') {
          setCurrentStep('products');
          searchInputRef.current?.focus();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentStep === 'products' && items.length > 0) {
          setCurrentStep('review');
        }
        return;
      }
      
      switch (e.key) {
        case 'F2':
          e.preventDefault();
          setIsCartFocused(false);
          setIsPaymentFocused(false);
          setIsQuantityFocused(false);
          setSelectedCartIndex(-1);
          setPendingProduct(null);
          setCurrentMode('search');
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
          break;
          
        case 'F3':
          e.preventDefault();
          setIsCartFocused(false);
          setIsPaymentFocused(false);
          setSelectedCartIndex(-1);
          setIsQuantityFocused(true);
          setCurrentMode('quantity');
          quantityInputRef.current?.focus();
          quantityInputRef.current?.select();
          break;
          
        case 'F4':
          e.preventDefault();
          if (items.length > 0) {
            setIsCartFocused(true);
            setIsPaymentFocused(false);
            setIsQuantityFocused(false);
            setSelectedCartIndex(items.length - 1);
            setSelectedProductIndex(-1);
            setPendingProduct(null);
            setCurrentMode('cart');
            (document.activeElement as HTMLElement)?.blur();
            cartListRef.current?.focus?.({ preventScroll: true } as FocusOptions) ?? cartListRef.current?.focus();

            playBeep('add');
          }
          break;
          
        case 'F5':
          e.preventDefault();
          setIsCartFocused(false);
          setIsQuantityFocused(false);
          setIsPaymentFocused(true);
          setPendingProduct(null);
          setCurrentMode('payment');
          (document.activeElement as HTMLElement)?.blur();
          paymentRef.current?.focus?.({ preventScroll: true } as FocusOptions) ?? paymentRef.current?.focus();
          playBeep('add');
          break;
          
        case 'F6':
          e.preventDefault();
          setIsCartFocused(false);
          setIsPaymentFocused(false);
          setIsQuantityFocused(false);
          setPendingProduct(null);
          setCurrentMode('discount');
          discountInputRef.current?.focus();
          discountInputRef.current?.select();
          break;
          
        case 'F7':
          e.preventDefault();
          setIsCartFocused(false);
          setIsPaymentFocused(false);
          setIsQuantityFocused(false);
          setPendingProduct(null);
          setCurrentMode('discount');
          receivedAmountInputRef.current?.focus();
          receivedAmountInputRef.current?.select();
          playBeep('add');
          break;
          
        case 'F8':
          e.preventDefault();
          setIsCartFocused(false);
          setIsPaymentFocused(false);
          setIsQuantityFocused(false);
          setPendingProduct(null);
          setIsQuickAddMode(true);
          setQuickAddFocusField('name');
          setCurrentMode('search');
          setTimeout(() => {
            quickAddNameRef.current?.focus();
            quickAddNameRef.current?.select();
          }, 50);
          playBeep('add');
          break;
          
        case 'F9':
          e.preventDefault();
          if (items.length > 0) handleQuickSave();
          break;
          
        case 'F12':
          e.preventDefault();
          if (items.length > 0) handleCheckout();
          break;
          
        case 'Escape':
          e.preventDefault();
          if (showShortcutMap) {
            setShowShortcutMap(false);
          } else if (isQuickAddMode) {
            setIsQuickAddMode(false);
            setQuickAddName('');
            setQuickAddPrice(0);
            setQuickAddQty(1);
            setQuickAddFocusField('name');
            searchInputRef.current?.focus();
          } else if (isCartFocused) {
            setIsCartFocused(false);
            setSelectedCartIndex(-1);
            setCurrentMode('search');
            searchInputRef.current?.focus();
          } else if (isPaymentFocused) {
            setIsPaymentFocused(false);
            setCurrentMode('search');
            searchInputRef.current?.focus();
          } else if (pendingProduct) {
            setPendingProduct(null);
            setProductSearch('');
            searchInputRef.current?.focus();
          } else if (productSearch) {
            setProductSearch('');
            setSelectedProductIndex(-1);
          } else if (showShortcuts) {
            setShowShortcuts(false);
          }
          break;
          
        case 'Delete':
          // Extra safety: also guard by activeElement refs (belt-and-suspenders)
          if (
            items.length > 0 &&
            !isInSearchInput &&
            !isInQuantityInput &&
            !isInDiscountInput &&
            !isInReceivedInput
          ) {
            e.preventDefault();
            const itemToRemove = isCartFocused && selectedCartIndex >= 0 
              ? items[selectedCartIndex] 
              : items[items.length - 1];
            removeItem(itemToRemove.id);
            if (isCartFocused) {
              if (items.length <= 1) {
                setIsCartFocused(false);
                setSelectedCartIndex(-1);
                searchInputRef.current?.focus();
              } else {
                setSelectedCartIndex(Math.max(0, selectedCartIndex - 1));
              }
            }
          }
          break;
          
        case 'ArrowDown':
          if (isCartFocused && items.length > 0) {
            e.preventDefault();
            setSelectedCartIndex((prev) => prev < items.length - 1 ? prev + 1 : prev);
          } else if (filteredProducts.length > 0 && isInSearchInput) {
            e.preventDefault();
            const nextIndex = activeMainSearchIndex < filteredProducts.length - 1 ? activeMainSearchIndex + 1 : activeMainSearchIndex;
            setActiveMainSearchIndex(nextIndex);
            // Also sync selectedProductIndex for mobile visual highlighting
            setSelectedProductIndex(nextIndex);
          }
          break;
          
        case 'ArrowUp':
          if (isCartFocused && items.length > 0) {
            e.preventDefault();
            setSelectedCartIndex((prev) => prev > 0 ? prev - 1 : 0);
          } else if (filteredProducts.length > 0 && isInSearchInput) {
            e.preventDefault();
            const nextIndex = activeMainSearchIndex > 0 ? activeMainSearchIndex - 1 : 0;
            setActiveMainSearchIndex(nextIndex);
            // Also sync selectedProductIndex for mobile visual highlighting
            setSelectedProductIndex(nextIndex);
          }
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          if (isCartFocused && items.length > 0 && selectedCartIndex >= 0) {
            const item = items[selectedCartIndex];
            if (item) {
              updateItemQuantity(item.id, decrementQuantity(item.quantity, 0.01));
            }
          } else if (isInQuantityInput) {
            const newQty = decrementQuantity(quantity, 0.01);
            setQuantity(newQty);
            setQuantityStr(String(newQty));
          } else if (isInSearchInput && filteredProducts.length > 0 && activeMainSearchIndex >= 0) {
            // Search dropdown ArrowLeft — step down quantity
            const targetedItem = filteredProducts[activeMainSearchIndex];
            if (targetedItem) {
              const cartItem = items.find(i => i.productId === targetedItem.flatId);
              if (cartItem) {
                // Exists in cart — step down safely
                const currentQty = cartItem.quantity;
                let newQty: number;
                if (currentQty > 1.0) {
                  newQty = currentQty - 1.0;
                } else {
                  newQty = Math.max(0.1, currentQty - 0.1);
                }
                const roundedNewQty = parseFloat(newQty.toFixed(1));
                setSearchDropdownQty(roundedNewQty);
                setSearchDropdownQtyStr(String(roundedNewQty));
                // Fire live cart sync
                updateItemQuantity(cartItem.id, roundedNewQty);
              }
              // If not in cart and qty is 0, do nothing
            }
          } else if (isPaymentFocused) {
            setPaymentMethod('cash');
            playBeep('add');
          }
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          if (isCartFocused && items.length > 0 && selectedCartIndex >= 0) {
            const item = items[selectedCartIndex];
            if (item) {
              updateItemQuantity(item.id, incrementQuantity(item.quantity));
            }
          } else if (isInQuantityInput) {
            const newQty = incrementQuantity(quantity);
            setQuantity(newQty);
            setQuantityStr(String(newQty));
          } else if (isInSearchInput && filteredProducts.length > 0 && activeMainSearchIndex >= 0) {
            // Search dropdown ArrowRight — step up quantity and instant cart sync
            const targetedItem = filteredProducts[activeMainSearchIndex];
            if (targetedItem) {
              const cartItem = items.find(i => i.productId === targetedItem.flatId);
              if (cartItem) {
                // Already in cart — step up
                const currentQty = cartItem.quantity;
                let newQty: number;
                if (currentQty >= 1.0) {
                  newQty = currentQty + 1.0;
                } else {
                  newQty = currentQty + 0.1;
                }
                const roundedNewQty = parseFloat(newQty.toFixed(1));
                setSearchDropdownQty(roundedNewQty);
                setSearchDropdownQtyStr(String(roundedNewQty));
                updateItemQuantity(cartItem.id, roundedNewQty);
              } else {
                // Not in cart — initialize at 1.0 and add to cart
                setSearchDropdownQty(1.0);
                setSearchDropdownQtyStr("1.0");
                // Build FlattenedProduct and add to cart with qty 1
                addProductToCart(targetedItem, 1);
              }
            }
          } else if (isPaymentFocused) {
            setPaymentMethod('credit');
            playBeep('add');
          }
          break;
          
        case 'Enter':
          if (isQuickAddMode) {
            e.preventDefault();
            addQuickAddItem();
          } else if (pendingProduct && isInQuantityInput) {
            e.preventDefault();
            addProductToCart(pendingProduct);
            setPendingProduct(null);
            setCurrentMode('search');
            searchInputRef.current?.focus();
          } else if (isInSearchInput && filteredProducts.length > 0) {
            e.preventDefault();
            const useIndex = activeMainSearchIndex >= 0 ? activeMainSearchIndex : (selectedProductIndex >= 0 ? selectedProductIndex : 0);
            const productToSelect = filteredProducts[useIndex];
            if (productToSelect) {
              setPendingProduct(productToSelect);
              setProductSearch('');
              setSelectedProductIndex(-1);
              setActiveMainSearchIndex(-1);
              setQuantity(1);
              setQuantityStr("1");
              setIsQuantityFocused(true);
              setCurrentMode('quantity');
              setTimeout(() => {
                quantityInputRef.current?.focus();
                quantityInputRef.current?.select();
              }, 50);
              playBeep('add');
              toast.info(`${productToSelect.displayName} - ${t('quickCheckout.enterQuantity')}`);
            }
          }
          break;
          
        case 'Tab':
          if (isQuickAddMode) {
            e.preventDefault();
            if (e.shiftKey) {
              if (quickAddFocusField === 'qty') {
                setQuickAddFocusField('displayPrice');
                quickAddDisplayPriceRef.current?.focus();
              } else if (quickAddFocusField === 'displayPrice') {
                setQuickAddFocusField('price');
                quickAddPriceRef.current?.focus();
              } else if (quickAddFocusField === 'price') {
                setQuickAddFocusField('name');
                quickAddNameRef.current?.focus();
              } else {
                setQuickAddFocusField('qty');
                quickAddQtyRef.current?.focus();
              }
            } else {
              if (quickAddFocusField === 'name') {
                setQuickAddFocusField('price');
                quickAddPriceRef.current?.focus();
              } else if (quickAddFocusField === 'price') {
                setQuickAddFocusField('displayPrice');
                quickAddDisplayPriceRef.current?.focus();
              } else if (quickAddFocusField === 'displayPrice') {
                setQuickAddFocusField('qty');
                quickAddQtyRef.current?.focus();
              } else {
                setQuickAddFocusField('name');
                quickAddNameRef.current?.focus();
              }
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, productSearch, filteredProducts, selectedProductIndex, selectedCartIndex, isCartFocused, isPaymentFocused, isQuantityFocused, pendingProduct, showShortcuts, showShortcutMap, currentStep, handleCheckout, handleQuickSave, removeItem, addProductToCart, updateItemQuantity, playBeep, t, incrementQuantity, decrementQuantity, isQuickAddMode, quickAddFocusField, addQuickAddItem]);

  // Auto-focus search on mount
  useEffect(() => {
    if (!isMobile) {
      searchInputRef.current?.focus();
    }
  }, [isMobile]);

  // Active-scroll synchronization
  useEffect(() => {
    if (isCartFocused && selectedCartIndex >= 0) {
      const itemElement = cartItemRefs.current.get(selectedCartIndex);
      if (itemElement) {
        itemElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedCartIndex, isCartFocused]);

  useEffect(() => {
    if (selectedProductIndex >= 0) {
      const itemElement = productItemRefs.current.get(selectedProductIndex);
      if (itemElement) {
        itemElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedProductIndex]);

  const isDark = theme === 'dark';

  const columnConfigs: ColumnResizeConfig[] = useMemo(() => [
    { key: 'product', defaultWidth: 18, minWidth: 10, maxWidth: 32 },
    { key: 'cost', defaultWidth: 8, minWidth: 5, maxWidth: 14 },
    { key: 'last', defaultWidth: 8, minWidth: 5, maxWidth: 14 },
    { key: 'sales', defaultWidth: 10, minWidth: 6, maxWidth: 16 },
    { key: 'display', defaultWidth: 10, minWidth: 6, maxWidth: 16 },
    { key: 'stock', defaultWidth: 8, minWidth: 5, maxWidth: 14 },
    { key: 'qty', defaultWidth: 10, minWidth: 6, maxWidth: 16 },
    { key: 'subtotal', defaultWidth: 14, minWidth: 8, maxWidth: 20 },
  ], []);
  const {
    getGridTemplateColumns,
    getResizeHandlerProps,
    isResizing,
    resetWidths,
  } = useColumnResize(columnConfigs);

  const stepIndex = currentStep === 'products' ? 1 : 2;
  const canProceedToReview = items.length > 0;

  // ==================== MOBILE LAYOUT ====================
  if (isMobile) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'} pb-40`}>
        <ShortcutMapOverlay
          isOpen={showShortcutMap}
          onClose={() => setShowShortcutMap(false)}
          currentStep={currentStep === 'products' ? 'products' : 'review'}
          currentMode={currentMode}
          isQuickCheckout={true}
          stepIndex={stepIndex}
          totalSteps={1}
        />

        <div className={`sticky top-0 z-50 px-3 py-2.5 ${isDark ? 'bg-slate-800/98 backdrop-blur-lg border-b border-slate-700/50' : 'bg-slate-50/98 backdrop-blur-lg border-b border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/invoices')}
                className={`p-2 -ml-1 rounded-xl transition-all active:scale-95 ${isDark ? 'active:bg-slate-700' : 'active:bg-slate-100'}`}
              >
                <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
              </button>
              <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('quickCheckout.title')}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* ── TRIPLE CHECKBOX FILTER ROW (Mobile) ── */}
                  <label className={`flex items-center gap-1 cursor-pointer select-none text-[9px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <input
                      type="checkbox"
                      checked={searchBarcode}
                      onChange={e => setSearchBarcode(e.target.checked)}
                      className="accent-amber-500 w-2.5 h-2.5 rounded"
                    />
                    Barcode
                  </label>
                  <label className={`flex items-center gap-1 cursor-pointer select-none text-[9px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <input
                      type="checkbox"
                      checked={searchByKey}
                      onChange={e => setSearchByKey(e.target.checked)}
                      className="accent-amber-500 w-2.5 h-2.5 rounded"
                    />
                    Search Key
                  </label>
                  <label className={`flex items-center gap-1 cursor-pointer select-none text-[9px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <input
                      type="checkbox"
                      checked={searchByName}
                      onChange={e => setSearchByName(e.target.checked)}
                      className="accent-amber-500 w-2.5 h-2.5 rounded"
                    />
                    Product Name
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl transition-all active:scale-95 ${soundEnabled ? 'text-emerald-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button
                onClick={clearCart}
                disabled={items.length === 0}
                className={`p-2 rounded-xl transition-all active:scale-95 disabled:opacity-30 text-red-500`}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className={`sticky top-[52px] z-40 px-3 py-2 ${isDark ? 'bg-slate-900/98 backdrop-blur-lg' : 'bg-slate-50/98 backdrop-blur-lg'}`}>
          {pendingProduct && (
            <div className={`mb-2 p-2 rounded-xl flex items-center justify-between animate-pulse ${isDark ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-amber-50 border-2 border-amber-300'}`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/30' : 'bg-amber-200'}`}>
                  <Package className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-700'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-xs truncate ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{isSinhala ? (pendingProduct.product.nameAlt || pendingProduct.displayName) : pendingProduct.displayName}</p>
                  <p className={`text-[10px] ${isDark ? 'text-amber-400/70' : 'text-amber-600'}`}>
                    {t('common.currency')} {pendingProduct.retailPrice.toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setPendingProduct(null); }}
                className={`p-1 rounded-xl ${isDark ? 'active:bg-amber-500/30 text-amber-400' : 'active:bg-amber-200 text-amber-700'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ScanLine className={`w-4 h-4 ${mobileSearchFocused ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                inputMode="search"
                placeholder={t('quickCheckout.searchPlaceholder')}
                value={productSearch}
                onChange={(e) => {
                  e.stopPropagation();
                  (e.nativeEvent as Event).stopImmediatePropagation?.();
                  const val = e.target.value;
                  if (handleBarcodeScanDispatch(val)) return;
                  const parsed = parseScanInput(val);
                  if (parsed?.qty && parsed?.code) {
                    const match = inventoryItems.find(
                      (inv) => inv.barcode === parsed.code || inv.searchKey.toLowerCase() === parsed.code.toLowerCase()
                    );
                    if (match) {
                      const sinhalaName = match.nameSinhala || match.nameSi || match.name;
                      const fp: FlattenedProduct = {
                        flatId: match.id,
                        product: { nameAlt: sinhalaName, sku: match.searchKey, category: match.productCategory } as any,
                        variant: undefined,
                        displayName: match.name,
                        displaySku: match.searchKey,
                        displayBarcode: match.barcode,
                        costPrice: match.cost,
                        wholesalePrice: match.displayPrice,
                        retailPrice: match.salesPrice,
                        discountedPrice: undefined,
                        hasDiscount: false,
                        stock: match.storeQty,
                        minStock: 0,
                        isVariant: false,
                        variantLabel: undefined,
                      } as FlattenedProduct;
                      addProductToCart(fp, parsed.qty);
                      setProductSearch('');
                      return;
                    }
                    setProductSearch(parsed.code);
                    return;
                  }
                  setProductSearch(val);
                  setSelectedProductIndex(-1);
                  setActiveMainSearchIndex(-1);
                }}
                onKeyDown={(e) => {
                  // Let arrow keys, Enter, and Escape pass through to window-level handler
                  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
                    e.stopPropagation();
                    (e.nativeEvent as Event).stopImmediatePropagation?.();
                  }
                }}
                onKeyUp={(e) => {
                  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
                    e.stopPropagation();
                    (e.nativeEvent as Event).stopImmediatePropagation?.();
                  }
                }}
                onFocus={() => {
                  setMobileSearchFocused(true);
                  setIsCartFocused(false);
                  setSelectedCartIndex(-1);
                  setIsPaymentFocused(false);
                }}
                onBlur={() => setTimeout(() => setMobileSearchFocused(false), 200)}
                className={`w-full pl-9 pr-9 py-2 text-sm border-2 rounded-xl focus:outline-none transition-all ${
                  mobileSearchFocused
                    ? isDark
                      ? 'border-amber-500 bg-slate-800 text-white ring-2 ring-amber-500/20'
                      : 'border-amber-500 bg-white text-slate-900 ring-2 ring-amber-100'
                    : isDark
                      ? 'border-slate-700 bg-slate-800/80 text-white placeholder-slate-500'
                      : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400'
                }`}
              />
              {productSearch && (
                <button
                  onClick={() => { setProductSearch(''); }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-xl active:scale-95 ${isDark ? 'active:bg-slate-700 text-slate-400' : 'active:bg-slate-200 text-slate-500'}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <div className={`flex items-center gap-1 px-1.5 rounded-xl border-2 ${
              pendingProduct
                ? isDark ? 'border-amber-500 bg-amber-500/10' : 'border-amber-400 bg-amber-50'
                : isDark ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-white'
            }`}>
              <button
                onClick={() => {
                  const newQty = decrementQuantity(quantity, 0.01);
                  setQuantity(newQty);
                  setQuantityStr(String(newQty));
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 ${isDark ? 'active:bg-slate-700 text-slate-400' : 'active:bg-slate-200 text-slate-600'}`}
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                ref={quantityInputRef}
                id="main-checkout-qty-input"
                type="text"
                inputMode="decimal"
                value={quantityStr}
                onChange={(e) => {
                  setQuantityStr(e.target.value);
                }}
                onFocus={() => {
                  setIsCartFocused(false);
                  setSelectedCartIndex(-1);
                  setIsPaymentFocused(false);
                }}
                onBlur={() => {
                  syncQuantityFromStr();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pendingProduct) {
                    e.preventDefault();
                    syncQuantityFromStr();
                    addProductToCart(pendingProduct);
                    setPendingProduct(null);
                    setProductSearch('');
                    setQuantityStr("1");
                    setTimeout(() => {
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
                    }, 30);
                  }
                }}
                className={`w-10 py-2 text-center font-bold text-sm bg-transparent focus:outline-none ${isDark ? 'text-white' : 'text-slate-900'}`}
              />
              <button
                onClick={() => {
                  const newQty = incrementQuantity(quantity);
                  setQuantity(newQty);
                  setQuantityStr(String(newQty));
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 ${isDark ? 'active:bg-slate-700 text-slate-400' : 'active:bg-slate-200 text-slate-600'}`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {(filteredProducts.length > 0 || (productSearch && filteredProducts.length === 0)) && (
          <div className="px-3 mb-2">
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white shadow-sm'}`}>
              {filteredProducts.length > 0 ? (
                <div className="max-h-[40vh] overflow-y-auto">
                  {filteredProducts.map((flatProduct, index) => (
                    <button
                      key={flatProduct.flatId}
                      ref={(el) => {
                        if (el) productItemRefs.current.set(index, el);
                        else productItemRefs.current.delete(index);
                      }}
                      onClick={() => {
                        setPendingProduct(flatProduct);
                        setProductSearch('');
                        setSelectedProductIndex(-1);
                        setQuantity(1);
                        setQuantityStr("1");
                        setIsQuantityFocused(true);
                        setCurrentMode('quantity');
                        setTimeout(() => {
                          quantityInputRef.current?.focus();
                          quantityInputRef.current?.select();
                        }, 50);
                        playBeep('add');
                        toast.info(`${flatProduct.displayName} - ${t('quickCheckout.enterQuantity')}`);
                      }}
                      className={`w-full flex items-center gap-2 p-2.5 text-left transition-all active:scale-[0.98] border-b last:border-b-0 ${
                        index === selectedProductIndex
                          ? isDark ? 'bg-amber-500/20' : 'bg-amber-50'
                          : isDark ? 'active:bg-slate-700/70 border-slate-700/50' : 'active:bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        <Package className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {isSinhala ? (flatProduct.product.nameAlt || flatProduct.displayName) : flatProduct.displayName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {flatProduct.displaySku}
                          </span>
                          <span className={`text-[10px] px-1 py-0.5 rounded ${
                            flatProduct.stock > 10 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : flatProduct.stock > 0 
                                ? 'bg-amber-500/10 text-amber-500' 
                                : 'bg-red-500/10 text-red-500'
                          }`}>
                            {flatProduct.stock}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {flatProduct.hasDiscount && flatProduct.discountedPrice ? (
                          <>
                            <p className={`text-[10px] line-through ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              Rs. {flatProduct.retailPrice.toLocaleString()}
                            </p>
                            <p className="text-xs font-bold text-pink-500">
                              Rs. {flatProduct.discountedPrice.toLocaleString()}
                            </p>
                          </>
                        ) : (
                          <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Rs. {flatProduct.retailPrice.toLocaleString()}
                          </p>
                        )}
                      </div>
                      {/* ── INLINE QUANTITY CONTROLS (mobile search) ── */}
                      <div className={`flex items-center gap-0.5 p-0.5 rounded-lg flex-shrink-0 ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const currentQty = getItemCartQuantity(items, flatProduct.flatId);
                            if (currentQty > 0) {
                              const cartItem = items.find(i => i.productId === flatProduct.flatId);
                              if (cartItem) {
                                const newQty = decrementQuantity(cartItem.quantity, 0.01);
                                if (newQty <= 0) {
                                  removeItem(cartItem.id);
                                } else {
                                  updateItemQuantity(cartItem.id, newQty);
                                }
                              }
                            }
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold transition-all ${
                            getItemCartQuantity(items, flatProduct.flatId) > 0
                              ? isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 shadow-sm'
                              : isDark ? 'text-slate-600 cursor-default' : 'text-slate-300 cursor-default'
                          }`}
                          disabled={getItemCartQuantity(items, flatProduct.flatId) <= 0}
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className={`w-5 text-center font-bold text-[9px] tabular-nums ${
                          getItemCartQuantity(items, flatProduct.flatId) > 0
                            ? 'text-amber-500'
                            : isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {getItemCartQuantity(items, flatProduct.flatId)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (flatProduct.stock > 0) {
                              addProductToCart(flatProduct, 1);
                              playBeep('add');
                            } else {
                              playBeep('error');
                              toast.error(t('quickCheckout.insufficientStock'));
                            }
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold transition-all ${
                            isDark
                              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                          }`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Package className={`w-10 h-10 mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                  <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                    {t('quickCheckout.noProductsFound')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-3 pb-4">
          <div className={`rounded-xl border min-h-[150px] ${isDark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className={`flex items-center justify-between px-3 py-2 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
              <h2 className={`font-bold flex items-center gap-1.5 text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <ShoppingCart className="w-4 h-4" />
                {t('quickCheckout.cartItems')}
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                items.length > 0
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                  : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
              }`}>
                {items.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            </div>
            
            {items.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-8 px-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <ShoppingCart className="w-7 h-7 opacity-40" />
                </div>
                <p className="text-sm font-medium">{t('quickCheckout.emptyCart')}</p>
                <p className="text-[11px] mt-1 text-center">{t('quickCheckout.scanOrSearch')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    onTouchStart={(e) => handleTouchStart(e, item.id)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      transform: swipedItemId === item.id ? `translateX(${touchDeltaX}px)` : 'translateX(0)',
                      transition: swipedItemId === item.id ? 'none' : 'transform 0.2s ease-out',
                    }}
                    className={`relative p-2.5 ${
                      swipedItemId === item.id && touchDeltaX < -30
                        ? isDark ? 'bg-red-500/20' : 'bg-red-50'
                        : swipedItemId === item.id && touchDeltaX > 30
                          ? isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'
                          : ''
                    }`}
                  >
                    {swipedItemId === item.id && touchDeltaX < -30 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                        <Trash2 className="w-5 h-5" />
                      </div>
                    )}
                    {swipedItemId === item.id && touchDeltaX > 30 && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500">
                        <Plus className="w-5 h-5" />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {isSinhala ? (item.productNameSi || item.productName) : item.productName}
                        </p>
                        <div className={`text-xs flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.unitPrice !== item.originalPrice && (
                            <span className="line-through text-[10px]">
                              Rs. {item.originalPrice.toLocaleString()}
                            </span>
                          )}
                          <span className={item.unitPrice !== item.originalPrice ? 'text-emerald-500 font-medium' : ''}>
                            Rs. {item.unitPrice.toLocaleString()}
                          </span>
                          <span>× {item.quantity}</span>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateItemQuantity(item.id, decrementQuantity(item.quantity, 0.01)); }}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all active:scale-90 ${
                            isDark ? 'active:bg-slate-600 text-slate-300' : 'active:bg-slate-200 text-slate-600'
                          }`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={`w-6 text-center font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateItemQuantity(item.id, incrementQuantity(item.quantity)); }}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all active:scale-90 ${
                            isDark ? 'active:bg-slate-600 text-slate-300' : 'active:bg-slate-200 text-slate-600'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <p className={`w-16 text-right font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Rs. {item.total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`fixed bottom-0 left-0 right-0 z-50 ${isDark ? 'bg-slate-800/98 backdrop-blur-xl border-t border-slate-700' : 'bg-white/98 backdrop-blur-xl border-t border-slate-200 shadow-2xl'}`}>
          <div className="flex justify-center pt-1.5 pb-0.5">
            <div className={`w-8 h-0.5 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
          </div>
          
          <div className="px-3 pb-2">
            <div className="grid grid-cols-2 gap-1.5">
              <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <button
                  onClick={() => { setPaymentMethod('cash'); playBeep('add'); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                      : isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  {t('invoice.cash')}
                </button>
                <button
                  onClick={() => { setPaymentMethod('credit'); playBeep('add'); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-all ${
                    paymentMethod === 'credit'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                      : isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {t('quickCheckout.credit')}
                </button>
              </div>
              
              <div className={`flex items-center gap-1.5 px-2 rounded-lg border ${isDark ? 'border-slate-700 bg-slate-700/50' : 'border-slate-200 bg-slate-50'}`}>
                <Percent className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  ref={discountInputRef}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={computedSubtotal}
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder={t('quickCheckout.discount')}
                  className={`flex-1 py-2 text-xs font-medium bg-transparent focus:outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                />
              </div>
              
              <div className={`flex items-center gap-1.5 px-2 rounded-lg border ${isDark ? 'border-slate-700 bg-green-900/20' : 'border-green-200 bg-green-50'}`}>
                <Banknote className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
                <input
                  ref={receivedAmountInputRef}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={receivedAmount || ''}
                  onChange={(e) => setReceivedAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder={t('invoice.receivedAmount')}
                  className={`flex-1 py-2 text-xs font-medium bg-transparent focus:outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                />
                {receivedAmount > 0 && (
                  <span className={`text-xs font-bold ${changeAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    Δ {changeAmount.toLocaleString()}
                  </span>
                )}
              </div>
              
              <button
                onClick={handleCheckout}
                disabled={items.length === 0 || isProcessing}
                className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                  items.length > 0
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                    : isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    {t('quickCheckout.checkoutAndPrint')}
                  </>
                )}
              </button>
            </div>
            {/* ── Update Invoice button (mobile, visible only in Edit Mode) ── */}
            {editInvoiceId && (
              <div className="mt-1.5">
                <button
                  onClick={handleUpdateInvoice}
                  disabled={items.length === 0 || isProcessing}
                  className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                    items.length > 0
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                      : isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {t('quickCheckout.updateInvoice')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== DESKTOP LAYOUT (optimized) ====================
  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <ShortcutMapOverlay
        isOpen={showShortcutMap}
        onClose={() => setShowShortcutMap(false)}
        currentStep={currentStep === 'products' ? 'products' : 'review'}
        currentMode={currentMode}
        isQuickCheckout={true}
        stepIndex={stepIndex}
        totalSteps={1}
      />

      {/* Compact toolbar */}
      <div className={`sticky top-0 z-10 px-3 py-1.5 ${isDark ? 'bg-slate-800/95 backdrop-blur border-b border-slate-700/50' : 'bg-slate-50/95 backdrop-blur border-b border-slate-200 shadow-sm'}`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/invoices')}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow shadow-amber-500/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('quickCheckout.title')}
            </span>
            <div className="flex items-center gap-2 ml-2">
              {/* ── TRIPLE CHECKBOX FILTER ROW (Desktop) ── */}
              <label className={`flex items-center gap-1 cursor-pointer select-none text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <input
                  type="checkbox"
                  checked={searchBarcode}
                  onChange={e => setSearchBarcode(e.target.checked)}
                  className="accent-amber-500 w-3 h-3 rounded"
                />
                Barcode
              </label>
              <label className={`flex items-center gap-1 cursor-pointer select-none text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <input
                  type="checkbox"
                  checked={searchByKey}
                  onChange={e => setSearchByKey(e.target.checked)}
                  className="accent-amber-500 w-3 h-3 rounded"
                />
                Search Key
              </label>
              <label className={`flex items-center gap-1 cursor-pointer select-none text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <input
                  type="checkbox"
                  checked={searchByName}
                  onChange={e => setSearchByName(e.target.checked)}
                  className="accent-amber-500 w-3 h-3 rounded"
                />
                Product Name
              </label>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${soundEnabled ? 'text-emerald-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}
              title={soundEnabled ? t('quickCheckout.soundOn') : t('quickCheckout.soundOff')}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowShortcutMap(true)}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${showShortcutMap ? 'text-blue-500' : isDark ? 'text-slate-400' : 'text-slate-600'}`}
              title={t('quickCheckout.keyboardShortcuts')}
            >
              <Keyboard className="w-4 h-4" />
            </button>
            <button
              onClick={clearCart}
              disabled={items.length === 0}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 disabled:opacity-30' : 'hover:bg-slate-100 disabled:opacity-30'} text-red-500`}
              title={t('quickCheckout.clearCart')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-3">
        <div className="flex gap-4 items-start">
          {/* ── LEFT + CENTRE: 12-col grid ── */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Panel - Main checkout area */}
          <div className="lg:col-span-8 space-y-2">
            {/* Condensed Search Bar */}
            <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
              {pendingProduct && (
                <div className={`mb-2 p-2 rounded-lg flex items-center justify-between ${isDark ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center gap-2">
                    <Package className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                    <div>
                      <p className={`text-xs font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{isSinhala ? (pendingProduct.product.nameAlt || pendingProduct.displayName) : pendingProduct.displayName}</p>
                      <p className={`text-[10px] ${isDark ? 'text-amber-400/70' : 'text-amber-600'}`}>
                        {t('quickCheckout.enterQuantityPrompt')} • Rs. {pendingProduct.retailPrice.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setPendingProduct(null); searchInputRef.current?.focus(); }}
                    className={`p-0.5 rounded-lg ${isDark ? 'hover:bg-amber-500/30 text-amber-400' : 'hover:bg-amber-200 text-amber-700'}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              
              <div className="flex gap-2 relative">
                <div className="flex-1">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Barcode className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder={t('quickCheckout.searchPlaceholder')}
                      value={productSearch}
                      onPaste={handlePaste}
                      onFocus={() => {
                        setIsCartFocused(false);
                        setSelectedCartIndex(-1);
                        setIsPaymentFocused(false);
                        setCurrentMode('search');
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        (e.nativeEvent as Event).stopImmediatePropagation?.();
                        const val = e.target.value;
                        if (handleBarcodeScanDispatch(val)) return;
                        const parsed = parseScanInput(val);
                        if (parsed?.qty && parsed?.code) {
                          const match = inventoryItems.find(
                            (inv) => inv.barcode === parsed.code || inv.searchKey.toLowerCase() === parsed.code.toLowerCase()
                          );
                          if (match) {
                            const sinhalaName = match.nameSinhala || match.nameSi || match.name;
                            const fp: FlattenedProduct = {
                              flatId: match.id,
                              product: { nameAlt: sinhalaName, sku: match.searchKey, category: match.productCategory } as any,
                              variant: undefined,
                              displayName: match.name,
                              displaySku: match.searchKey,
                              displayBarcode: match.barcode,
                              costPrice: match.cost,
                              wholesalePrice: match.displayPrice,
                              retailPrice: match.salesPrice,
                              discountedPrice: undefined,
                              hasDiscount: false,
                              stock: match.storeQty,
                              minStock: 0,
                              isVariant: false,
                              variantLabel: undefined,
                            } as FlattenedProduct;
                            addProductToCart(fp, parsed.qty);
                            setProductSearch('');
                            setSelectedProductIndex(-1);
                            return;
                          }
                          setProductSearch(parsed.code);
                          setSelectedProductIndex(-1);
                          return;
                        }
                        setProductSearch(val);
                        setSelectedProductIndex(-1);
                      }}
                      onKeyDown={(e) => {
                        // Let arrow keys, Enter, and Escape pass through to window-level handler
                        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
                          e.stopPropagation();
                          (e.nativeEvent as Event).stopImmediatePropagation?.();
                        }
                      }}
                      onKeyUp={(e) => {
                        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
                          e.stopPropagation();
                          (e.nativeEvent as Event).stopImmediatePropagation?.();
                        }
                      }}
                      className={`w-full pl-9 pr-8 py-2 text-sm border-2 rounded-lg focus:outline-none transition-all ${
                        isDark
                          ? 'border-slate-600 bg-slate-700/50 text-white placeholder-slate-500 focus:border-amber-500'
                          : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                      }`}
                      autoComplete="off"
                    />
                    {productSearch && (
                      <button
                        onClick={() => {
                          setProductSearch('');
                          setSelectedProductIndex(-1);
                          searchInputRef.current?.focus();
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowProductFormModal(true)}
                  className={`flex items-center gap-1 px-1.5 py-2 rounded-lg font-bold text-xs transition-all bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow shadow-amber-500/30`}
                >
                  <Plus className="w-3 h-3" />
                  <span>AP</span>
                </button>

                {(filteredProducts.length > 0 || (productSearch && filteredProducts.length === 0)) && (
                  <div className={`absolute left-0 right-0 top-full z-50 mt-1 backdrop-blur-md border rounded-xl shadow-2xl overflow-y-auto max-h-[65vh] custom-scrollbar ${
                    isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-lg'
                  }`}>
                    {filteredProducts.length > 0 ? (
                      <div className="p-1">
                        {filteredProducts.map((flatProduct, index) => (
                          <button
                            key={flatProduct.flatId}
                            ref={(el) => {
                              if (el) productItemRefs.current.set(index, el);
                              else productItemRefs.current.delete(index);
                            }}
                            onClick={() => {
                              setPendingProduct(flatProduct);
                              setProductSearch('');
                              setSelectedProductIndex(-1);
                              setQuantity(1);
                              setQuantityStr("1");
                              setIsQuantityFocused(true);
                              setCurrentMode('quantity');
                              setTimeout(() => {
                                quantityInputRef.current?.focus();
                                quantityInputRef.current?.select();
                              }, 50);
                              playBeep('add');
                              toast.info(`${flatProduct.displayName} - ${t('quickCheckout.enterQuantity')}`);
                            }}
                            className={`w-full flex items-center gap-2 p-2 text-left transition-colors border-b last:border-b-0 rounded-lg ${
                              index === activeMainSearchIndex
                                ? isDark ? 'bg-slate-800 border-l-4 border-amber-500 shadow-xl' : 'bg-amber-100 border-l-4 border-amber-500 shadow'
                                : index === selectedProductIndex
                                  ? isDark ? 'bg-amber-500/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                                  : isDark ? 'hover:bg-slate-700/50 border-slate-700' : 'hover:bg-white border-slate-200'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-white'}`}>
                              <Package className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-sm font-bold text-emerald-400">
                                {flatProduct.stock}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {isSinhala ? (flatProduct.product.nameAlt || flatProduct.displayName) : flatProduct.displayName}
                                </p>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {flatProduct.displaySku}
                                  </span>
                                </div>
                              </div>
                            </div>
                        <div className="text-right">
                              <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Rs. {flatProduct.retailPrice.toLocaleString()}
                              </p>
                            </div>
                            {/* ── INLINE QUANTITY CONTROLS (native, no auto-close) ── */}
                            <div className={`flex items-center gap-0.5 p-0.5 rounded-lg flex-shrink-0 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const currentQty = getItemCartQuantity(items, flatProduct.flatId);
                                  if (currentQty > 0) {
                                    // Decrement: find the cart item for this product and update quantity
                                    const cartItem = items.find(i => i.productId === flatProduct.flatId);
                                    if (cartItem) {
                                      const newQty = decrementQuantity(cartItem.quantity, 0.01);
                                      if (newQty <= 0) {
                                        removeItem(cartItem.id);
                                      } else {
                                        updateItemQuantity(cartItem.id, newQty);
                                      }
                                    }
                                  }
                                }}
                                className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-all ${
                                  getItemCartQuantity(items, flatProduct.flatId) > 0
                                    ? isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 shadow-sm'
                                    : isDark ? 'text-slate-600 cursor-default' : 'text-slate-300 cursor-default'
                                }`}
                                disabled={getItemCartQuantity(items, flatProduct.flatId) <= 0}
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className={`w-5 text-center font-bold text-[10px] tabular-nums ${
                                getItemCartQuantity(items, flatProduct.flatId) > 0
                                  ? 'text-amber-500'
                                  : isDark ? 'text-slate-500' : 'text-slate-400'
                              }`}>
                                {getItemCartQuantity(items, flatProduct.flatId)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  // Always add: increment or append
                                  if (flatProduct.stock > 0) {
                                    addProductToCart(flatProduct, 1);
                                    // Keep search open — do NOT close the dropdown
                                    // Keep focus on search
                                    setTimeout(() => searchInputRef.current?.focus(), 10);
                                  } else {
                                    playBeep('error');
                                    toast.error(t('quickCheckout.insufficientStock'));
                                  }
                                }}
                                className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-all ${
                                  isDark
                                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
                                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                }`}
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center">
                        <Package className={`w-8 h-8 mx-auto mb-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {t('quickCheckout.noProductsFound')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {/* Condensed Quantity Input */}
                <div className="flex items-center gap-1">
                  <label className={`text-[10px] font-medium mr-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Qty:</label>
                  <div className="relative flex items-center">
                    <button
                      onClick={() => {
                        const newQty = decrementQuantity(quantity, 0.01);
                        setQuantity(newQty);
                        setQuantityStr(String(newQty));
                      }}
                      className={`p-1 rounded ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <input
                      ref={quantityInputRef}
                      id="main-checkout-qty-input"
                      type="text"
                      inputMode="decimal"
                      value={quantityStr}
                      onChange={(e) => {
                        setQuantityStr(e.target.value);
                      }}
                      onFocus={() => {
                        setIsQuantityFocused(true);
                        setIsCartFocused(false);
                        setSelectedCartIndex(-1);
                        setIsPaymentFocused(false);
                        setCurrentMode('quantity');
                      }}
                      onBlur={() => {
                        setIsQuantityFocused(false);
                        syncQuantityFromStr();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && pendingProduct) {
                          e.preventDefault();
                          syncQuantityFromStr();
                          addProductToCart(pendingProduct);
                          setPendingProduct(null);
                          setProductSearch('');
                          setQuantityStr("1");
                          setTimeout(() => {
                            searchInputRef.current?.focus();
                            searchInputRef.current?.select();
                          }, 30);
                        }
                      }}
                      className={`w-14 py-1.5 text-sm text-center font-bold border-2 rounded-lg focus:outline-none transition-all ${
                        pendingProduct
                          ? isDark 
                            ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500/30' 
                            : 'border-amber-400 bg-amber-50 text-slate-900 ring-1 ring-amber-200'
                          : isDark
                            ? 'border-slate-600 bg-slate-700/50 text-white focus:border-amber-500'
                            : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-amber-500'
                      }`}
                    />
                    <button
                      onClick={() => {
                        const newQty = incrementQuantity(quantity);
                        setQuantity(newQty);
                        setQuantityStr(String(newQty));
                      }}
                      className={`p-1 rounded ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Cart Items */}
            <div 
              ref={cartListRef}
              tabIndex={-1}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsCartFocused(false);
                  setSelectedCartIndex(-1);
                }
              }}
              className={`p-3 rounded-xl border outline-none overflow-x-hidden ${
                isCartFocused 
                  ? isDark ? 'bg-slate-800/50 border-amber-500/50 ring-1 ring-amber-500/20' : 'bg-slate-50 border-amber-400 ring-1 ring-amber-200 shadow'
                  : isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className={`font-bold flex items-center gap-1.5 text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <ShoppingCart className="w-4 h-4" />
                  {t('quickCheckout.cartItems')} ({items.length})
                  {isCartFocused && (
                    <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                      ↑↓ → ← 0-9
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setIsQuickAddMode(!isQuickAddMode);
                      if (!isQuickAddMode) {
                        setTimeout(() => quickAddNameRef.current?.focus(), 50);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      isQuickAddMode
                        ? 'bg-teal-500 text-white shadow-sm'
                        : isDark
                          ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/50'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    {isQuickAddMode ? 'Close' : 'Custom'}
                    <kbd className={`ml-0.5 px-1 py-0.5 rounded text-[8px] font-mono ${
                      isQuickAddMode ? 'bg-white/20 text-white' : isDark ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'
                    }`}>F8</kbd>
                  </button>
                  <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>F4</kbd>
                  <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>F9</kbd>
                </div>
              </div>
              {isQuickAddMode && (
                <div className={`mb-2 p-2 rounded-lg border ${isDark ? 'bg-teal-500/10 border-teal-500/50 ring-1 ring-teal-500/20' : 'bg-teal-50 border-teal-400 ring-1 ring-teal-200'}`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Plus className={`w-3 h-3 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <span className={`text-xs font-semibold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                      {t('quickCheckout.quickAddTitle')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input ref={quickAddNameRef} type="text" placeholder={t('quickCheckout.itemName')} value={quickAddName} onChange={(e) => setQuickAddName(e.target.value)} onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setQuickAddFocusField('name'); }} className={`flex-[2] min-w-[50px] px-2 py-1.5 text-xs border rounded-lg focus:outline-none ${quickAddFocusField === 'name' ? isDark ? 'border-teal-500 bg-slate-700 text-white ring-1 ring-teal-500/30' : 'border-teal-500 bg-white text-slate-900 ring-1 ring-teal-200' : isDark ? 'border-slate-600 bg-slate-700/50 text-white' : 'border-slate-200 bg-white text-slate-900'}`} />
                    <div className="w-[96px]">
                      <input ref={quickAddPriceRef} type="text" inputMode="decimal" placeholder="Sales Price" value={quickAddPriceStr} onChange={(e) => { setQuickAddPriceStr(e.target.value); const parsed = parseQuantityInput(e.target.value); if (!isNaN(parsed) && parsed > 0) setQuickAddPrice(parsed); }} onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setQuickAddFocusField('price'); }} className={`w-full px-2 py-1.5 text-xs text-right border rounded-lg focus:outline-none ${quickAddFocusField === 'price' ? isDark ? 'border-teal-500 bg-slate-700 text-white ring-1 ring-teal-500/30' : 'border-teal-500 bg-white text-slate-900 ring-1 ring-teal-200' : isDark ? 'border-slate-600 bg-slate-700/50 text-white' : 'border-slate-200 bg-white text-slate-900'}`} />
                    </div>
                    <div className="w-[96px]">
                      <input ref={quickAddDisplayPriceRef} type="text" inputMode="decimal" placeholder="Display Price" value={quickAddDisplayPriceStr} onChange={(e) => { setQuickAddDisplayPriceStr(e.target.value); const parsed = parseQuantityInput(e.target.value); if (!isNaN(parsed) && parsed > 0) setQuickAddDisplayPrice(parsed); }} onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setQuickAddFocusField('displayPrice'); }} className={`w-full px-2 py-1.5 text-xs text-right border rounded-lg focus:outline-none ${quickAddFocusField === 'displayPrice' ? isDark ? 'border-teal-500 bg-slate-700 text-white ring-1 ring-teal-500/30' : 'border-teal-500 bg-white text-slate-900 ring-1 ring-teal-200' : isDark ? 'border-slate-600 bg-slate-700/50 text-white' : 'border-slate-200 bg-white text-slate-900'}`} />
                    </div>
                    <div className="w-[80px]">
                      <input ref={quickAddQtyRef} type="text" inputMode="decimal" placeholder={t('quickCheckout.qty')} value={quickAddQtyStr} onChange={(e) => { setQuickAddQtyStr(e.target.value); const parsed = parseQuantityInput(e.target.value); if (!isNaN(parsed) && parsed > 0) setQuickAddQty(parsed); }} onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setQuickAddFocusField('qty'); }} className={`w-full px-2 py-1.5 text-xs text-center border rounded-lg focus:outline-none ${quickAddFocusField === 'qty' ? isDark ? 'border-teal-500 bg-slate-700 text-white ring-1 ring-teal-500/30' : 'border-teal-500 bg-white text-slate-900 ring-1 ring-teal-200' : isDark ? 'border-slate-600 bg-slate-700/50 text-white' : 'border-slate-200 bg-white text-slate-900'}`} />
                    </div>
                    <button onClick={addQuickAddItem} className={`px-2 py-1.5 rounded-lg text-xs font-medium ${quickAddName && parseQuantityInput(quickAddPriceStr) > 0 ? 'bg-teal-500 hover:bg-teal-600 text-white' : isDark ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              
              {items.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <ShoppingCart className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">{t('quickCheckout.emptyCart')}</p>
                  <p className="text-xs mt-0.5">{t('quickCheckout.scanOrSearch')}</p>
                </div>
              ) : (
                <>
                {/* Cart table header — fluid column resizing */}
                <div
                  className={`grid px-2 py-2.5 mb-1 rounded-lg text-xs font-black uppercase tracking-wider select-none ${isDark ? 'text-slate-400 bg-slate-800/50' : 'text-slate-500 bg-slate-100'}`}
                  style={{ gridTemplateColumns: getGridTemplateColumns() }}
                >
                  <div className="truncate relative group/header">
                    Product
                    <span {...getResizeHandlerProps('product')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} title="Drag to resize" />
                  </div>
                  <div className="text-right truncate relative group/header">
                    Cost
                    <span {...getResizeHandlerProps('cost')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} />
                  </div>
                  <div className="text-right truncate relative group/header">
                    Last
                    <span {...getResizeHandlerProps('last')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} />
                  </div>
                  <div className="text-right truncate relative group/header">
                    Sales
                    <span {...getResizeHandlerProps('sales')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} />
                  </div>
                  <div className="text-right truncate relative group/header">
                    Display
                    <span {...getResizeHandlerProps('display')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} />
                  </div>
                  <div className="text-center truncate relative group/header">
                    Stock
                    <span {...getResizeHandlerProps('stock')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} />
                  </div>
                  <div className="text-center truncate relative group/header">
                    Qty
                    <span {...getResizeHandlerProps('qty')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} />
                  </div>
                  <div className="text-right truncate relative group/header">
                    Subtotal
                    <span {...getResizeHandlerProps('subtotal')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} />
                  </div>
                </div>
                <div 
                  ref={cartItemsContainerRef}
                  className="space-y-1 h-[280px] overflow-y-auto"
                >
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      ref={(el) => {
                        if (el) cartItemRefs.current.set(index, el);
                        else cartItemRefs.current.delete(index);
                      }}
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        setIsCartFocused(true);
                        setSelectedCartIndex(index);
                        setSelectedProductIndex(-1);
                        setPendingProduct(null);
                        setCurrentMode('cart');
                        if (document.activeElement instanceof HTMLInputElement) {
                          document.activeElement.blur();
                        }
                        cartListRef.current?.focus();
                        playBeep('add');
                      }}
                      onFocus={() => {
                        setIsCartFocused(true);
                        setSelectedCartIndex(index);
                        setCurrentMode('cart');
                      }}
                      className={`grid items-center px-2 py-2.5 rounded-lg transition-all cursor-pointer outline-none relative group ${
                        isCartFocused && index === selectedCartIndex
                          ? isDark 
                            ? 'bg-amber-500/20 shadow ring-1 ring-amber-500/50' 
                            : 'bg-amber-50 shadow ring-1 ring-amber-400/50'
                          : isDark ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                      style={{ gridTemplateColumns: getGridTemplateColumns() }}
                    >
                      <div className="min-w-0 truncate">
                        <p className={`text-sm font-semibold truncate leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {isSinhala ? (item.productNameSi || item.productName) : item.productName}
                        </p>
                      </div>
                      <div className="text-right truncate">
                        <span className={`text-sm font-mono font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {Number(item.cost || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right truncate">
                        <span className={`text-sm font-mono font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {Number(item.lastPrice || 0).toFixed(2)}
                        </span>
                      </div>
                      {/* ══════ INLINE SALES PRICE — click-to-edit toggle ── REFACTORED ── */}
                      <div className="text-right truncate">
                        {editingCell?.itemId === item.id && editingCell?.field === 'salesPrice' ? (
                          <input
                            ref={inlineEditInputRef}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            className={`w-20 font-bold text-right rounded border px-1.5 py-1 focus:outline-none text-sm font-mono tabular-nums ${
                              isDark
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500 ring-1 ring-amber-500/30'
                                : 'bg-amber-50 text-amber-700 border-amber-400 ring-1 ring-amber-200'
                            }`}
                            value={inlineEditStr}
                            onChange={(e) => {
                              // No live validation — just update the string for display
                              setInlineEditStr(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitCartItemPrice(item.id);
                              }
                            }}
                            onBlur={() => {
                              commitCartItemPrice(item.id);
                            }}
                          />
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: 'salesPrice' });
                              setInlineEditStr(String(Number(item.salesPrice || item.ourPrice || 0)));
                            }}
                            className={`cursor-pointer hover:bg-amber-500/10 rounded px-1 -mx-1 transition-colors text-sm font-mono font-bold tabular-nums ${
                              isDark ? 'text-amber-400' : 'text-amber-600'
                            }`}
                          >
                            {Number(item.salesPrice || item.ourPrice || 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {/* DISPLAY — displayPrice */}
                      {/* CASHIER COLUMN RULE: If salesPrice > displayPrice, keep the numeric value visible
                          but apply line-through + muted opacity so the cashier can audit the baseline
                          rate while visually flagging it as overridden. */}
                      <div className="text-right truncate">
                        {Number(item.salesPrice || item.ourPrice || 0) > Number(item.displayPrice || 0) ? (
                          <span className={`text-sm font-mono line-through opacity-40 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {Number(item.displayPrice || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className={`text-sm font-bold font-mono ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                            {Number(item.displayPrice || 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-center truncate">
                        <span className={`text-sm font-mono font-semibold ${item.storeQty !== undefined && item.storeQty < 10 ? 'text-amber-500 font-bold animate-pulse' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.storeQty ?? '—'}
                        </span>
                      </div>
                      {/* ══════ INLINE QUANTITY — click-to-edit toggle ── REFACTORED ── */}
                      <div className="flex justify-center items-center">
                        {editingCell?.itemId === item.id && editingCell?.field === 'quantity' ? (
                          <input
                            ref={inlineEditInputRef}
                            type="text"
                            inputMode="decimal"
                            step="any"
                            className={`w-16 font-bold text-center rounded border py-1 focus:outline-none text-sm tabular-nums ${
                              isDark
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500 ring-1 ring-amber-500/30'
                                : 'bg-amber-50 text-amber-700 border-amber-400 ring-1 ring-amber-200'
                            }`}
                            value={inlineEditStr}
                            onChange={(e) => {
                              // No live mutation — just track the string
                              setInlineEditStr(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const raw = parseQuantityInput(inlineEditStr);
                                const parsed = !isNaN(raw) && raw > 0 ? toTwoDecimals(raw) : NaN;
                                if (!isNaN(parsed) && parsed > 0) {
                                  updateItemQuantity(item.id, parsed);
                                }
                                setEditingCell(null);
                              }
                            }}
                            onBlur={() => {
                              const raw = parseQuantityInput(inlineEditStr);
                              const parsed = !isNaN(raw) && raw > 0 ? toTwoDecimals(raw) : NaN;
                              if (!isNaN(parsed) && parsed > 0) {
                                updateItemQuantity(item.id, parsed);
                              }
                              setEditingCell(null);
                            }}
                          />
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: 'quantity' });
                              setInlineEditStr(String(item.quantity));
                            }}
                            className={`cursor-pointer hover:bg-amber-500/10 rounded px-1.5 -mx-1.5 transition-colors text-sm font-bold font-mono tabular-nums ${
                              isDark ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {item.quantity}
                          </span>
                        )}
                      </div>
                      <div className="text-right pr-2 truncate">
                        <span className={`text-sm font-bold font-mono tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {(Number(item.salesPrice || item.ourPrice || 0) * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                          className="p-0.5 rounded text-red-500 hover:bg-red-500/10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>

            {/* ── Quick Categories (live from DB, scrollable fixed-height grid) ── */}
            <div className={`rounded-xl border ${isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="p-2.5 pb-0">
                <div className="flex justify-between items-center mb-2 border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                    <h3 className={`text-xs font-bold tracking-wide uppercase ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      {t('quickCheckout.quickCategories')}
                    </h3>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {quickCheckoutCategories.length}
                    </span>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => setShowDisplaySettings(true)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all duration-200 flex items-center gap-1 ${
                      isDark 
                        ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800' 
                        : 'bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Settings
                  </button>
                </div>
              </div>

              <div className="px-2.5 pb-2.5">
                <div className="max-h-[290px] md:max-h-[310px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {quickCheckoutCategories.map((cat) => {
                      const categoryProducts = categoryProductMap.get(cat.name) || [];
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            if (categoryProducts.length > 0) {
                              const rect = (document.querySelector(`[data-cat-id="${cat.id}"]`) as HTMLElement)?.getBoundingClientRect();
                              if (rect) {
                                setCategoryPopoverAnchor(rect);
                              }
                              setActiveCategoryPopover(cat.name);
                              setCategoryPopoverFilter('');
                              setTimeout(() => categoryPopoverInputRef.current?.focus(), 100);
                            } else {
                              toast.info(`${getCategoryDisplayName(cat, cat.name)} - ${t('quickCheckout.noProductsFound')}`);
                            }
                          }}
                          data-cat-id={cat.id}
                          className={`relative group rounded-xl flex flex-col items-center justify-center text-center min-h-[72px] transition-all duration-200 ${
                            isDark
                              ? 'bg-slate-800/50 border border-slate-700/80 hover:border-slate-600 hover:bg-slate-800/60 active:scale-95'
                              : 'bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-95 shadow-sm'
                          }`}
                        >
                          <div className="w-full flex flex-col items-center justify-center py-2 px-1">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${
                              (quickCheckoutCategories.indexOf(cat) % 2) === 0 ? 'from-cyan-500 to-blue-600' : 'from-amber-500 to-orange-500'
                            } flex items-center justify-center mb-1 shadow-lg`}>
                              <Package className="w-4 h-4 text-white" />
                            </div>
                            <span className={`text-[13px] font-bold leading-tight line-clamp-2 text-center break-words max-w-full ${
                              isDark ? 'text-slate-300' : 'text-slate-700'
                            }`}>
                              {getCategoryDisplayName(cat, cat.name)}
                            </span>
                            <div className="w-1 h-1 rounded-full bg-cyan-500 shadow-glow mt-0.5"></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Display Settings Modal ── */}
            {showDisplaySettings && (
              <DisplaySettingsModal
                isOpen={showDisplaySettings}
                onClose={() => setShowDisplaySettings(false)}
              />
            )}

          {/* ── CATEGORY PRODUCT POPOVER ── */}
            {activeCategoryPopover && categoryPopoverAnchor && (
              <>
                {/* Removed: backdrop overlay no longer auto-closes the category popup on click.
                    Popup now only closes via the explicit X button, Esc key, or checkout completion. */}
                <div 
                  ref={categoryPopoverRef}
                  className={`fixed z-[201] rounded-xl border shadow-2xl overflow-hidden animate-fade-in ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}
                  style={{
                    top: Math.max(8, categoryPopoverAnchor.top - 360),
                    left: Math.max(8, Math.min(categoryPopoverAnchor.left, window.innerWidth - 360)),
                    width: 350,
                    maxHeight: 340,
                  }}
                >
                  {(() => {
                    const catProducts = inventoryItems
                      .filter(inv => inv.productCategory === activeCategoryPopover)
                      .filter(item => {
                        if (!categoryPopoverFilter.trim()) return true;
                        const q = categoryPopoverFilter.toLowerCase();
                        return item.name.toLowerCase().includes(q) || 
                               (item.searchKey && item.searchKey.toLowerCase().includes(q));
                      });
                    const filteredCategoryProducts = catProducts;

                    return (
                      <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border relative`}>
                        {quantityPromptProduct ? (
                          <div className={`absolute inset-0 z-50 ${
                            isDark ? 'bg-slate-950/95' : 'bg-white/95'
                          } backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 animate-fade-in`}>
                            <div className={`${
                              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                            } border rounded-2xl p-5 max-w-sm w-full text-center shadow-2xl`}>
                              <span className="text-[10px] text-amber-500 font-black tracking-widest uppercase block mb-1">අවශ්‍ය ප්‍රමාණය ඇතුළත් කරන්න</span>
                              <h3 className={`text-xs font-black mb-4 line-clamp-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{quantityPromptProduct.name}</h3>
                              <input
                                type="text"
                                inputMode="decimal"
                                autoFocus
                                value={categoryPromptQty}
                                onChange={(e) => setCategoryPromptQty(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const parsed = parseQuantityInput(categoryPromptQty);
                                    const finalQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
                                    const sinhalaName = quantityPromptProduct.nameSinhala || quantityPromptProduct.nameSi || quantityPromptProduct.name;
                                    const fp: FlattenedProduct = {
                                      flatId: quantityPromptProduct.id,
                                      product: { nameAlt: sinhalaName, sku: quantityPromptProduct.searchKey, category: activeCategoryPopover } as any,
                                      displayName: quantityPromptProduct.name,
                                      displaySku: quantityPromptProduct.searchKey,
                                      retailPrice: Number(quantityPromptProduct.salesPrice),
                                      wholesalePrice: Number(quantityPromptProduct.displayPrice),
                                      costPrice: Number(quantityPromptProduct.cost),
                                      stock: Number(quantityPromptProduct.storeQty),
                                      hasDiscount: false,
                                    } as FlattenedProduct;
                                    addProductToCart(fp, finalQty);
                                    const displayQtyName = isSinhala
                                      ? (quantityPromptProduct.nameSinhala || quantityPromptProduct.nameSi || quantityPromptProduct.name)
                                      : quantityPromptProduct.name;
                                    toast.success(`${displayQtyName} × ${finalQty} ${t('quickCheckout.addedToCart')}`);
                                    setQuantityPromptProduct(null);
                                    setActiveCategoryPopover(null);
                                    setCategoryPopoverFilter('');
                                    setActiveCategoryItemIndex(0);
                                    setTimeout(() => searchInputRef.current?.focus(), 50);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setQuantityPromptProduct(null);
                                    setTimeout(() => categoryPopoverInputRef.current?.focus(), 50);
                                  }
                                }}
                                className={`w-full border-2 focus:border-amber-500 rounded-xl p-3 text-center text-lg font-black focus:outline-none tracking-widest mb-4 ${
                                  isDark 
                                    ? 'bg-slate-950 border-slate-800 text-white' 
                                    : 'bg-white border-slate-300 text-slate-900'
                                }`}
                              />
                              <div className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                Press <kbd className={`px-1.5 py-0.5 rounded border ${isDark ? 'bg-slate-950 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>Enter</kbd> to Add • <kbd className={`px-1.5 py-0.5 rounded border ${isDark ? 'bg-slate-950 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>Esc</kbd> to Cancel
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={`flex items-center justify-between px-3 py-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center`}>
                                  <Package className="w-3 h-3 text-white" />
                                </div>
                            <span className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {getCategoryDisplayName(activeCategoryEntity, activeCategoryPopover || '')}
                                </span>
                                <span className={`text-[9px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {filteredCategoryProducts.length} items
                                </span>
                              </div>
                              <button 
                                onClick={() => { setActiveCategoryPopover(null); setActiveCategoryItemIndex(0); }}
                                className={`p-0.5 rounded transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className={`px-3 py-1.5 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}>
                              <div className="relative">
                                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                <input
                                  ref={categoryPopoverInputRef}
                                  type="text"
                                  value={categoryPopoverFilter}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setCategoryPopoverFilter(e.target.value);
                                    setActiveCategoryItemIndex(0);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder={`Filter ${activeCategoryPopover} items...`}
                                  onKeyDown={(e) => {
                                    if (filteredCategoryProducts.length === 0) return;

                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      setActiveCategoryItemIndex((prev) => 
                                        prev < filteredCategoryProducts.length - 1 ? prev + 1 : prev
                                      );
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setActiveCategoryItemIndex((prev) => (prev > 0 ? prev - 1 : 0));
                                    } else if (e.key === 'ArrowRight') {
                                      // ── Category Popup ArrowRight — step up quantity and instant cart sync ──
                                      e.preventDefault();
                                      const targetedItem = filteredCategoryProducts[activeCategoryItemIndex];
                                      if (targetedItem) {
                                        const cartItem = items.find(i => i.productId === targetedItem.id);
                                        if (cartItem) {
                                          const currentQty = cartItem.quantity;
                                          let newQty: number;
                                          if (currentQty >= 1.0) {
                                            newQty = currentQty + 1.0;
                                          } else {
                                            newQty = currentQty + 0.1;
                                          }
                                          const roundedNewQty = parseFloat(newQty.toFixed(1));
                                          updateItemQuantity(cartItem.id, roundedNewQty);
                                        } else {
                                          // Not in cart — add with qty 1
                                          const sinhalaName = targetedItem.nameSinhala || targetedItem.nameSi || targetedItem.name;
                                          const fp: FlattenedProduct = {
                                            flatId: targetedItem.id,
                                            product: { nameAlt: sinhalaName, sku: targetedItem.searchKey, category: activeCategoryPopover } as any,
                                            displayName: targetedItem.name,
                                            displaySku: targetedItem.searchKey,
                                            retailPrice: Number(targetedItem.salesPrice),
                                            wholesalePrice: Number(targetedItem.displayPrice),
                                            costPrice: Number(targetedItem.cost),
                                            stock: Number(targetedItem.storeQty),
                                            hasDiscount: false,
                                          } as FlattenedProduct;
                                          addProductToCart(fp, 1);
                                        }
                                      }
                                      // FOCUS LOCK: force focus back to category sub-filter input
                                      setTimeout(() => categoryPopoverInputRef.current?.focus(), 10);
                                    } else if (e.key === 'ArrowLeft') {
                                      // ── Category Popup ArrowLeft — step down quantity ──
                                      e.preventDefault();
                                      const targetedItem = filteredCategoryProducts[activeCategoryItemIndex];
                                      if (targetedItem) {
                                        const cartItem = items.find(i => i.productId === targetedItem.id);
                                        if (cartItem) {
                                          const currentQty = cartItem.quantity;
                                          let newQty: number;
                                          if (currentQty > 1.0) {
                                            newQty = currentQty - 1.0;
                                          } else {
                                            newQty = Math.max(0.1, currentQty - 0.1);
                                          }
                                          const roundedNewQty = parseFloat(newQty.toFixed(1));
                                          updateItemQuantity(cartItem.id, roundedNewQty);
                                        }
                                        // If not in cart, do nothing (floor at 0)
                                      }
                                      // FOCUS LOCK: force focus back to category sub-filter input
                                      setTimeout(() => categoryPopoverInputRef.current?.focus(), 10);
                                    } else if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const targetedProduct = filteredCategoryProducts[activeCategoryItemIndex];
                                      if (targetedProduct) {
                                          const sinhalaName = targetedProduct.nameSinhala || targetedProduct.nameSi || targetedProduct.name;
                                          const fp: FlattenedProduct = {
                                            flatId: targetedProduct.id,
                                            product: { nameAlt: sinhalaName, sku: targetedProduct.searchKey, category: activeCategoryPopover } as any,
                                          displayName: targetedProduct.name,
                                          displaySku: targetedProduct.searchKey,
                                          retailPrice: Number(targetedProduct.salesPrice),
                                          wholesalePrice: Number(targetedProduct.displayPrice),
                                          costPrice: Number(targetedProduct.cost),
                                          stock: Number(targetedProduct.storeQty),
                                          hasDiscount: false,
                                        } as FlattenedProduct;

                                        const searchToken = searchByKey ? targetedProduct.searchKey : targetedProduct.name;

                                        const normToken   = searchToken.toLowerCase();
                                        const strippedTok = normToken.replace(/\s+/g, '');
                                        const tokTokens   = normToken.split(/\s+/).filter(Boolean);
                                        let exactMatchCount = 0;
                                        for (const inv of inventoryItems) {
                                          const field         = searchByKey ? (inv.searchKey || '').toLowerCase() : inv.name.toLowerCase();
                                          const strippedField = field.replace(/\s+/g, '');
                                          const fieldTokens   = field.split(/\s+/).filter(Boolean);
                                          const isExact =
                                            strippedField === strippedTok ||
                                            (tokTokens.length === fieldTokens.length &&
                                              tokTokens.every((t, i) => t === fieldTokens[i]));
                                          if (isExact) exactMatchCount++;
                                        }

                                        setProductSearch(searchToken);
                                        setActiveCategoryPopover(null);
                                        setCategoryPopoverFilter('');
                                        setActiveCategoryItemIndex(0);

                                        if (exactMatchCount > 1) {
                                          setPendingProduct(null);
                                          setActiveMainSearchIndex(0);
                                          setCurrentMode('search');
                                          setTimeout(() => {
                                            searchInputRef.current?.focus();
                                          }, 50);
                                          playBeep('add');
                                        } else {
                                          setPendingProduct(fp);
                                          setQuantity(1);
                                          setQuantityStr("1");
                                          setIsQuantityFocused(true);
                                          setCurrentMode('quantity');
                                          setTimeout(() => {
                                            quantityInputRef.current?.focus();
                                            quantityInputRef.current?.select();
                                          }, 50);
                                          playBeep('add');
                                          const enterQtyName = isSinhala
                                            ? (targetedProduct.nameSinhala || targetedProduct.nameSi || targetedProduct.name)
                                            : targetedProduct.name;
                                          toast.info(`${enterQtyName} - ${t('quickCheckout.enterQuantity')}`);
                                        }
                                      }
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setActiveCategoryPopover(null);
                                      setActiveCategoryItemIndex(0);
                                      setCategoryPopoverFilter('');
                                      searchInputRef.current?.focus();
                                    }
                                  }}
                                  className={`w-full border focus:border-amber-500/50 rounded-xl p-3 pl-10 text-xs font-bold focus:outline-none mb-0 ${
                                    isDark 
                                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                                      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                                  }`}
                                />
                              </div>
                            </div>

                            <div 
                              ref={categoryListContainerRef}
                              className="overflow-y-auto custom-scrollbar" 
                              style={{ maxHeight: 220 }}
                            >
                              {filteredCategoryProducts.length > 0 ? (
                                <div className="flex flex-col gap-0.5 p-1">
                                  {filteredCategoryProducts.map((item, idx) => {
                                    const isFocusedRow = idx === activeCategoryItemIndex;
                                    return (
                                      <div
                                        key={item.id}
                                        data-cat-index={idx}
                                        onClick={() => {
                                          const sinhalaName = item.nameSinhala || item.nameSi || item.name;
                                          const fp: FlattenedProduct = {
                                            flatId: item.id,
                                            product: { nameAlt: sinhalaName, sku: item.searchKey, category: activeCategoryPopover } as any,
                                            displayName: item.name,
                                            displaySku: item.searchKey,
                                            retailPrice: Number(item.salesPrice),
                                            wholesalePrice: Number(item.displayPrice),
                                            costPrice: Number(item.cost),
                                            stock: Number(item.storeQty),
                                            hasDiscount: false,
                                          } as FlattenedProduct;

                                          const searchToken = searchByKey ? item.searchKey : item.name;

                                          const normToken   = searchToken.toLowerCase();
                                          const strippedTok = normToken.replace(/\s+/g, '');
                                          const tokTokens   = normToken.split(/\s+/).filter(Boolean);
                                          let exactMatchCount = 0;
                                          for (const inv of inventoryItems) {
                                            const field         = searchByKey ? (inv.searchKey || '').toLowerCase() : inv.name.toLowerCase();
                                            const strippedField = field.replace(/\s+/g, '');
                                            const fieldTokens   = field.split(/\s+/).filter(Boolean);
                                            const isExact =
                                              strippedField === strippedTok ||
                                              (tokTokens.length === fieldTokens.length &&
                                                tokTokens.every((t, i) => t === fieldTokens[i]));
                                            if (isExact) exactMatchCount++;
                                          }

                                          setProductSearch(searchToken);
                                          setActiveCategoryPopover(null);
                                          setCategoryPopoverFilter('');
                                          setActiveCategoryItemIndex(0);

                                          if (exactMatchCount > 1) {
                                            setPendingProduct(null);
                                            setActiveMainSearchIndex(0);
                                            setCurrentMode('search');
                                            setTimeout(() => {
                                              searchInputRef.current?.focus();
                                            }, 50);
                                            playBeep('add');
                                          } else {
                                            setPendingProduct(fp);
                                            setQuantity(1);
                                            setQuantityStr("1");
                                            setIsQuantityFocused(true);
                                            setCurrentMode('quantity');
                                            setTimeout(() => {
                                              quantityInputRef.current?.focus();
                                              quantityInputRef.current?.select();
                                            }, 50);
                                            playBeep('add');
                                            const clickEnterQtyName = isSinhala
                                              ? (item.nameSinhala || item.nameSi || item.name)
                                              : item.name;
                                            toast.info(`${clickEnterQtyName} - ${t('quickCheckout.enterQuantity')}`);
                                          }
                                        }}
                                        className={`p-2.5 rounded-xl flex items-center gap-2 transition-all duration-150 cursor-pointer border-l-4 ${
                                          isFocusedRow 
                                            ? isDark 
                                              ? 'bg-slate-800 border-l-4 border-amber-500 shadow-lg translate-x-0.5 scale-[1.01] z-10' 
                                              : 'bg-amber-50 border-l-4 border-amber-500 shadow-lg translate-x-0.5 scale-[1.01] z-10'
                                            : isDark 
                                              ? 'bg-slate-900/40 hover:bg-slate-900/80 border-l-4 border-transparent hover:border-slate-700' 
                                              : 'bg-slate-50 hover:bg-slate-100 border-l-4 border-transparent hover:border-slate-300'
                                        }`}
                                      >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                          isFocusedRow 
                                            ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20' 
                                            : isDark ? 'bg-slate-800' : 'bg-slate-200'
                                        }`}>
                                          <Package className={`w-3.5 h-3.5 ${isFocusedRow ? (isDark ? 'text-white' : 'text-amber-900') : isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                                        </div>
                                        <div className="flex flex-1 items-center gap-2 min-w-0">
                                          <span className="inline-flex min-w-[2.35rem] items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-400">
                                            {item.storeQty}
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <p className={`truncate text-[11px] font-semibold ${isFocusedRow ? (isDark ? 'text-white' : 'text-amber-900') : isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                              {isSinhala ? (item.nameSinhala || item.nameSi || item.name) : item.name}
                                            </p>
                                            <div className="mt-0.5 flex items-center gap-1.5">
                                              <span className={`text-[8px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                {item.searchKey}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 flex items-center gap-1">
                                          <p className={`text-[11px] font-black ${isFocusedRow ? 'text-amber-400' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                            Rs. {Number(item.salesPrice).toFixed(2)}
                                          </p>
                                          {/* ── INLINE QUANTITY CONTROLS (native, no auto-close) ── */}
                                          <div className={`flex items-center gap-0.5 p-0.5 rounded-md flex-shrink-0 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                const currentQty = getItemCartQuantity(items, item.id);
                                                if (currentQty > 0) {
                                                  const cartItem = items.find(i => i.productId === item.id);
                                                  if (cartItem) {
                                                    const newQty = decrementQuantity(cartItem.quantity, 0.01);
                                                    if (newQty <= 0) {
                                                      removeItem(cartItem.id);
                                                    } else {
                                                      updateItemQuantity(cartItem.id, newQty);
                                                    }
                                                  }
                                                }
                                              }}
                                              className={`w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold transition-all ${
                                                getItemCartQuantity(items, item.id) > 0
                                                  ? isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 shadow-sm'
                                                  : isDark ? 'text-slate-600 cursor-default' : 'text-slate-300 cursor-default'
                                              }`}
                                              disabled={getItemCartQuantity(items, item.id) <= 0}
                                            >
                                              <Minus className="w-2 h-2" />
                                            </button>
                                            <span className={`w-4 text-center font-bold text-[8px] tabular-nums ${
                                              getItemCartQuantity(items, item.id) > 0
                                                ? 'text-amber-500'
                                                : isDark ? 'text-slate-500' : 'text-slate-400'
                                            }`}>
                                              {getItemCartQuantity(items, item.id)}
                                            </span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                const sinhalaName = item.nameSinhala || item.nameSi || item.name;
                                                const fp: FlattenedProduct = {
                                                  flatId: item.id,
                                                  product: { nameAlt: sinhalaName, sku: item.searchKey, category: activeCategoryPopover } as any,
                                                  displayName: item.name,
                                                  displaySku: item.searchKey,
                                                  retailPrice: Number(item.salesPrice),
                                                  wholesalePrice: Number(item.displayPrice),
                                                  costPrice: Number(item.cost),
                                                  stock: Number(item.storeQty),
                                                  hasDiscount: false,
                                                } as FlattenedProduct;
                                                if (item.storeQty > 0) {
                                                  addProductToCart(fp, 1);
                                                  playBeep('add');
                                                } else {
                                                  playBeep('error');
                                                  toast.error(t('quickCheckout.insufficientStock'));
                                                }
                                              }}
                                              className={`w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold transition-all ${
                                                isDark
                                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
                                                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                              }`}
                                            >
                                              <Plus className="w-2 h-2" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className={`p-4 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-xs font-medium">No items found</p>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </>
          )}
          </div>

          {/* Right Panel - Checkout Summary */}
          <div className="lg:col-span-4 space-y-2">
            {/* Discount */}
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <Percent className="w-3 h-3" />
                  {t('quickCheckout.discount')}
                </h3>
                <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>F6</kbd>
              </div>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Rs.</span>
                <input ref={discountInputRef} type="number" min="0" max={computedSubtotal} value={discount || ''} onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))} onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setIsPaymentFocused(false); setCurrentMode('discount'); }} onBlur={() => setCurrentMode('search')} placeholder="0" className={`w-full pl-9 pr-3 py-2 text-sm text-right font-bold border-2 rounded-lg focus:outline-none transition-all ${isDark ? 'border-slate-600 bg-slate-700/50 text-white placeholder-slate-500 focus:border-amber-500' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-amber-500'}`} />
              </div>
            </div>

            {/* Received Amount */}
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <Banknote className={`w-3 h-3 ${receivedAmount > 0 && receivedAmount >= computedFinalTotal ? 'text-emerald-500' : ''}`} />
                  {t('invoice.receivedAmount')}
                </h3>
                <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>F7</kbd>
              </div>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Rs.</span>
                <input ref={receivedAmountInputRef} type="number" min="0" value={receivedAmount || ''} onChange={(e) => setReceivedAmount(Math.max(0, parseFloat(e.target.value) || 0))} onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setIsPaymentFocused(false); setCurrentMode('payment'); }} onBlur={() => setCurrentMode('search')} placeholder="0" className={`w-full pl-9 pr-3 py-2 text-sm text-right font-bold border-2 rounded-lg focus:outline-none transition-all ${isDark ? 'border-slate-600 bg-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-emerald-500'}`} />
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {[{ label: 'Exact', value: computedFinalTotal, isExact: true }, { label: '+100', value: Math.ceil(computedFinalTotal / 100) * 100 }, { label: '+500', value: Math.ceil(computedFinalTotal / 500) * 500 }, { label: '+1K', value: Math.ceil(computedFinalTotal / 1000) * 1000 }].map((btn) => (
                  <button key={btn.label} onClick={() => { setReceivedAmount(btn.value); playBeep('add'); }} className={`px-1 py-1 rounded text-[9px] font-medium transition-all ${btn.isExact ? isDark ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200' : isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>{btn.isExact ? '= ' + btn.value.toLocaleString() : btn.label}</button>
                ))}
              </div>
              {receivedAmount > 0 && (
                <div className={`mt-1.5 p-2 rounded-lg ${changeAmount >= 0 ? isDark ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200' : isDark ? 'bg-red-500/20 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-medium ${changeAmount >= 0 ? isDark ? 'text-emerald-400' : 'text-emerald-700' : isDark ? 'text-red-400' : 'text-red-700'}`}>{changeAmount >= 0 ? t('invoice.changeAmount') : t('invoice.balanceDue')}</span>
                    <span className={`text-sm font-bold font-mono ${changeAmount >= 0 ? isDark ? 'text-emerald-400' : 'text-emerald-600' : isDark ? 'text-red-400' : 'text-red-600'}`}>Rs. {Math.abs(changeAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h3 className={`text-xs font-semibold mb-2.5 flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Calculator className="w-3 h-3" />
                {t('quickCheckout.summary')}
              </h3>

              <div className="space-y-2 text-[11px]">
                <div className={`flex justify-between ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <span>{t('quickCheckout.itemCount')}</span>
                  <span className="font-medium tabular-nums">
                    {items.reduce((sum, i) => sum + i.quantity, 0)} {t('invoice.units')}
                  </span>
                </div>

                <div className={`flex justify-between ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <span>{t('invoice.subtotal')}</span>
                  <span className="font-mono tabular-nums">
                    Rs. {computedSubtotal.toFixed(2)}
                  </span>
                </div>

                {computedDiscount > 0 && (
                  <div className="flex justify-between items-center text-red-500">
                    <span>{t('quickCheckout.discount')}</span>
                    <span className="font-mono tabular-nums">- Rs. {computedDiscount.toFixed(2)}</span>
                  </div>
                )}

                {computedCustomerProfit > 0 && (
                  <div className={`flex justify-between items-center ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    <span className="font-semibold">ඔබ ලැබූ ලාභය</span>
                    <span className="font-mono font-bold tabular-nums">
                      Rs. {computedCustomerProfit.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className={`pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {t('invoice.totalAmount')}
                    </span>
                    <span className="text-base font-bold text-emerald-500 tabular-nums font-mono">
                      Rs. {computedFinalTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Checkout Button */}
            <button onClick={handleCheckout} disabled={items.length === 0 || isProcessing} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${items.length > 0 ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30' : isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              <Printer className="w-4 h-4" />
              {t('quickCheckout.checkoutAndPrint')}
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">F12</kbd>
            </button>
            
            {/* ── Update Invoice button (visible only in Edit Mode) ── */}
            {editInvoiceId && (
              <button onClick={handleUpdateInvoice} disabled={items.length === 0 || isProcessing} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${items.length > 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/30' : isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                <CheckCircle className="w-4 h-4" />
                {t('quickCheckout.updateInvoice')}
              </button>
            )}

            {/* ── CUSTOMER SELECTION: Searchable Combobox ── */}
            <div ref={customerContainerRef} className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <User className="w-3 h-3" />
                  Customer Selection
                </h3>
                <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>F3</kbd>
              </div>
              <div className="relative">
                <div className={`flex items-center gap-2 px-3 py-2 border-2 rounded-lg transition-all cursor-pointer w-full ${isDark ? 'border-slate-600 bg-slate-700/50 hover:border-slate-500' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                  <User className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onFocus={() => { setCustomerOpen(true); }}
                    placeholder="Search or select a customer..."
                    className={`flex-1 bg-transparent text-xs font-medium focus:outline-none w-full ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                  />
                  {selectedCustomerId !== 'walk-in' && (
                    <button onClick={() => { setSelectedCustomerId('walk-in'); setCustomerSearch(''); setCustomerOpen(false); }}
                      className={`p-0.5 rounded flex-shrink-0 ${isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {customerOpen && (
                  <div className={`absolute left-0 bottom-full mb-1 w-full rounded-lg border shadow-2xl z-50 overflow-hidden backdrop-blur-md ${isDark ? 'bg-slate-800/95 border-slate-700/50' : 'bg-white/95 border-slate-200'}`}>
                    <div className="max-h-32 overflow-y-auto">
                      <button onClick={() => { setSelectedCustomerId('walk-in'); setCustomerSearch(''); setCustomerOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${selectedCustomerId === 'walk-in' ? 'bg-orange-500/20 text-orange-400' : isDark ? 'text-slate-300 hover:bg-slate-700/50' : 'text-slate-700 hover:bg-slate-100'}`}>
                        <span className="flex items-center gap-2"><User className="w-3 h-3" />{isSinhala ? 'සාමාන්‍ය පාරිභෝගිකයා' : 'Walk-in Customer'}</span>
                      </button>
                      {customersLoading ? (
                        <div className="px-3 py-2 text-xs text-center text-slate-400">Loading customers...</div>
                      ) : (
                        filteredCustomers.map((c: any) => (
                          <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); setCustomerOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${selectedCustomerId === c.id ? 'bg-orange-500/20 text-orange-400' : isDark ? 'text-slate-300 hover:bg-slate-700/50' : 'text-slate-700 hover:bg-slate-100'}`}>
                            <span className="flex items-center gap-2"><Building2 className="w-3 h-3" />{isSinhala && c.nameSi ? c.nameSi : c.name}</span>
                          </button>
                        ))
                      )}
                      {!customersLoading && filteredCustomers.length === 0 && customerSearch && (
                        <div className={`px-3 py-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No customers found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* ── "+ New Customer" button — full-width, clean design ── */}
              <button
                onClick={() => {
                  setNewCustName('');
                  setNewCustPhone('');
                  setNewCustEmail('');
                  setNewCustAddress('');
                  setShowNewCustomerModal(true);
                  setCustomerOpen(false);
                }}
                className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed text-xs font-semibold transition-all ${isDark ? 'border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5' : 'border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                title="Add new customer"
              >
                <Plus className="w-4 h-4" />
                New Customer
              </button>
              {/* Show phone number of selected customer */}
              {selectedCustomerId !== 'walk-in' && selectedCustomerId && (() => {
                const c = findCustomerById(selectedCustomerId);
                return c ? (
                  <div className={`mt-1.5 p-1.5 rounded-lg ${isDark ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.phone || 'No phone'}</p>
                  </div>
                ) : null;
              })()}

              {/* ── API-Backed Quick Customer Modal ── */}
              {showNewCustomerModal && (
                <>
                  <div
                    className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
                    onClick={() => !isSavingCustomer && setShowNewCustomerModal(false)}
                  />
                  <div className={`fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl border shadow-2xl p-5 ${isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-white border-slate-200'}`}>
                    {/* Modal header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-white" />
                        </div>
                        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          Register Customer
                        </h3>
                      </div>
                      <button
                        onClick={() => !isSavingCustomer && setShowNewCustomerModal(false)}
                        className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Form fields */}
                    <div className="space-y-3">
                      {[
                        { label: 'Name *', value: newCustName,    setter: setNewCustName,    placeholder: 'Full name', type: 'text' },
                        { label: 'Phone *', value: newCustPhone,   setter: setNewCustPhone,   placeholder: '07X XXX XXXX', type: 'tel' },
                        { label: 'Email', value: newCustEmail,   setter: setNewCustEmail,   placeholder: 'email@example.com', type: 'email' },
                        { label: 'Address', value: newCustAddress, setter: setNewCustAddress, placeholder: 'Street, City', type: 'text' },
                      ].map(({ label, value, setter, placeholder, type }) => (
                        <div key={label}>
                          <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {label}
                          </label>
                          <input
                            type={type}
                            value={value}
                            onChange={e => setter(e.target.value)}
                            placeholder={placeholder}
                            className={`w-full px-3 py-2 text-xs font-medium rounded-lg border focus:outline-none focus:ring-2 transition-all ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:ring-emerald-200'}`}
                            disabled={isSavingCustomer}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Submit — POST to backend API */}
                    <button
                      onClick={async () => {
                        const trimmedName = newCustName.trim();
                        const trimmedPhone = newCustPhone.trim();
                        if (!trimmedName || !trimmedPhone) {
                          toast.error('Customer name and phone are required');
                          return;
                        }
                        setIsSavingCustomer(true);
                        try {
                          const created: any = await api.post('/customers', {
                            name: trimmedName,
                            phone: trimmedPhone,
                            email: newCustEmail.trim(),
                            address: newCustAddress.trim() || undefined,
                            customerType: 'regular',
                          });
                          // Add to local customers list
                          setCustomers(prev => [...prev, created]);
                          // Auto-select the new customer
                          setSelectedCustomerId(created.id);
                          setCustomerSearch(created.name);
                          setShowNewCustomerModal(false);
                          toast.success(`Customer "${created.name}" registered successfully`);
                        } catch (err: any) {
                          toast.error(err?.message || 'Failed to create customer');
                        } finally {
                          setIsSavingCustomer(false);
                        }
                      }}
                      disabled={isSavingCustomer}
                      className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow shadow-emerald-500/30 transition-all disabled:opacity-50"
                    >
                      {isSavingCustomer ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        'Save Customer'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Payment Method */}
            <div ref={paymentRef} tabIndex={-1} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsPaymentFocused(false); }} className={`p-3 rounded-xl border outline-none transition-all ${isPaymentFocused ? isDark ? 'bg-slate-800/50 border-blue-500/50 ring-1 ring-blue-500/20' : 'bg-white border-blue-400 ring-1 ring-blue-200 shadow' : isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <CreditCard className="w-3 h-3" />
                  {t('quickCheckout.paymentMethod')}
                </h3>
                <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>F5</kbd>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => { setPaymentMethod('cash'); playBeep('add'); }} className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-medium transition-all ${paymentMethod === 'cash' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow shadow-emerald-500/30' : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  <Banknote className="w-3.5 h-3.5" />
                  {t('invoice.cash')}
                </button>
                <button onClick={() => { setPaymentMethod('credit'); playBeep('add'); }} className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-medium transition-all ${paymentMethod === 'credit' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow shadow-blue-500/30' : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  <CreditCard className="w-3.5 h-3.5" />
                  {t('quickCheckout.credit')}
                </button>
              </div>
            </div>

          </div>
        </div>
          </div>{/* end flex-1 inner grid wrapper */}

          {/* ── RECEIPT PREVIEW COLUMN — visible on xl+ ── */}
          <div className="hidden xl:block w-full max-w-[440px] flex-shrink-0 sticky top-[52px] self-start max-h-[calc(100vh-68px)] overflow-y-auto min-w-0 min-h-0">
            <ThermalReceiptPreview
              items={items}
              discount={computedDiscount}
              receivedAmount={receivedAmount}
              paymentMethod={paymentMethod}
              subtotal={computedSubtotal}
              total={computedFinalTotal}
              customer={
                selectedCustomerId !== 'walk-in'
                  ? (findCustomerById(selectedCustomerId) ?? null)
                  : null
              }
              invoiceNumber="PREVIEW"
              language={isSinhala ? 'si' : 'en'}
              cashierName={currentUser?.name || 'Admin User'}
            />
          </div>
        </div>{/* end outer flex gap-4 */}
      </div>{/* end w-full px-6 py-3 */}

      {!isMobile && (
        <ShortcutHintsBar
          currentStep={currentStep === 'products' ? 'products' : 'review'}
          currentMode={currentMode}
          isQuickCheckout={true}
          onShowFullMap={() => setShowShortcutMap(true)}
        />
      )}

      {/* ── Unified Product Form Modal ── */}
      <ProductFormModal
        isOpen={showProductFormModal}
        onClose={() => setShowProductFormModal(false)}
        mode="create"
        initialData={null}
      />
    </div>
  );
};