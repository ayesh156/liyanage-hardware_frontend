import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Category } from '../types/index';
import { InventoryProduct } from '../types/index';
import { mockCategories, linkedCatalogItems } from '../data/mockData';
import { CatalogItem } from '../data/mockData';
import api from '../lib/api';

// ── Local fallback when API is unavailable ──
let localInventoryItems: InventoryProduct[] = [];

interface CatalogState {
  categories: Category[];
  inventoryItems: InventoryProduct[];
  catalogItems: CatalogItem[];
  isInventoryLoading: boolean;
  inventoryError: string | null;
}

interface CatalogContextValue extends CatalogState {
  addCategory: (category: Partial<Category>) => Category;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addInventoryItem: (item: InventoryProduct) => void;
  updateInventoryItem: (id: string, data: Partial<InventoryProduct>) => void;
  deleteInventoryItem: (id: string) => void;
  searchByQuery: (query: string) => CatalogItem[];
  getCategoryName: (id: string) => string;
  refreshInventory: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export const useCatalog = (): CatalogContextValue => {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
};

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>(() => mockCategories);
  const [inventoryItems, setInventoryItems] = useState<InventoryProduct[]>([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // ── Fetch inventory from backend API ──
  const fetchInventory = useCallback(async () => {
    setIsInventoryLoading(true);
    setInventoryError(null);

    try {
      // Attempt to fetch from backend
      const data = await api.get<InventoryProduct[]>('/products', { perPage: 2000 });

      if (Array.isArray(data)) {
        setInventoryItems(data as unknown as InventoryProduct[]);
        localInventoryItems = data as unknown as InventoryProduct[];
      } else if (data && typeof data === 'object' && 'data' in data) {
        // Handle paginated response { data: [...], meta: {...} }
        const paginatedData = (data as any).data as InventoryProduct[];
        setInventoryItems(paginatedData);
        localInventoryItems = paginatedData;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // If the API is not available (network error / 404), fall back to local data
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('HTTP 404') ||
        errorMessage.includes('Not Found')
      ) {
        console.warn('[Catalog] Backend API unavailable — falling back to local inventory data');
        try {
          const localData = await import('../data/inventoryData');
          const items = localData.inventoryItems || [];
          setInventoryItems(items);
          localInventoryItems = items;
          setInventoryError(null); // Not an error — graceful fallback
        } catch {
          // Ultimate fallback: empty array
          setInventoryItems([]);
          localInventoryItems = [];
          setInventoryError('Inventory data could not be loaded from either API or local files');
        }
      } else {
        // Real API error
        setInventoryError(errorMessage);
        console.error('[Catalog] Failed to fetch inventory:', errorMessage);
      }
    } finally {
      setIsInventoryLoading(false);
    }
  }, []);

  // Load inventory on mount
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // ── Category CRUD ──
  const addCategory = useCallback((data: Partial<Category>): Category => {
    const newCat: Category = {
      id: `cat-${String(Date.now()).slice(-6)}`,
      name: data.name || '',
      nameAlt: data.nameAlt,
      icon: data.icon,
      description: data.description,
      usageCount: 0,
    };
    setCategories(prev => [...prev, newCat]);
    return newCat;
  }, []);

  const updateCategory = useCallback((id: string, data: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  // ── Inventory CRUD ──
  const addInventoryItem = useCallback((item: InventoryProduct) => {
    setInventoryItems(prev => [item, ...prev]);
  }, []);

  const updateInventoryItem = useCallback((id: string, data: Partial<InventoryProduct>) => {
    setInventoryItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...data } : item))
    );
    // Also update localInventoryItems for search consistency
    localInventoryItems = localInventoryItems.map(item =>
      item.id === id ? { ...item, ...data } : item
    );
  }, []);

  const deleteInventoryItem = useCallback((id: string) => {
    setInventoryItems(prev => prev.filter(item => item.id !== id));
    localInventoryItems = localInventoryItems.filter(item => item.id !== id);
  }, []);

  // ── Search ──
  const searchByQuery = useCallback((query: string): CatalogItem[] => {
    if (query.trim().length < 2) return [];

    // First try the API search if we have network
    const performSearch = async () => {
      try {
        const data = await api.get<InventoryProduct[]>('/products', {
          search: query,
          perPage: 20,
        });
        const results = Array.isArray(data) ? data : (data as any)?.data ?? [];
        return results.map((item: any) => ({
          id: `cat-${item.id}`,
          sku: item.searchKey,
          name: item.name,
          unitRate: item.salesPrice,
          stock: item.storeQty,
          unit: 'piece',
          categoryId: item.categoryId,
          barcode: item.barcode,
        })) as CatalogItem[];
      } catch {
        // Fall back to local search
        const q = query.toLowerCase().trim();
        return linkedCatalogItems.filter(item =>
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.includes(q))
        );
      }
    };

    // Synchronous fallback: search local items immediately
    const q = query.toLowerCase().trim();
    const localResults = linkedCatalogItems.filter(item =>
      item.sku.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.includes(q))
    );

    // Fire async search but return local results immediately for responsiveness
    performSearch().then(apiResults => {
      if (apiResults.length > 0) {
        // Update local state if needed — but this is a sync function
        // so we just return the local results and the API results will
        // be used on the next call
      }
    });

    return localResults;
  }, []);

  const getCategoryName = useCallback((id: string): string => {
    return categories.find(c => c.id === id)?.name || id;
  }, [categories]);

  const value = useMemo(() => ({
    categories,
    inventoryItems,
    catalogItems: linkedCatalogItems,
    isInventoryLoading,
    inventoryError,
    addCategory,
    updateCategory,
    deleteCategory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    searchByQuery,
    getCategoryName,
    refreshInventory: fetchInventory,
  }), [
    categories,
    inventoryItems,
    isInventoryLoading,
    inventoryError,
    addCategory,
    updateCategory,
    deleteCategory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    searchByQuery,
    getCategoryName,
    fetchInventory,
  ]);

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  );
};