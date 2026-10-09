import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Package, Check, X, Barcode, Plus, Minus, Ruler, Banknote, ArrowDownAZ } from 'lucide-react';
import { InventoryProduct, FlattenedProduct } from '../../types';
import ProductNameTooltip from '../ProductNameTooltip';
import { rankSearchResults, calculateRelevanceScore } from '../../lib/searchScoring';
import { naturalDimensionComparator } from '../../lib/dimensionParser';

export interface ProductSearchComboboxProps {
  products: InventoryProduct[];
  onSelectProduct: (product: InventoryProduct, quantity?: number) => void;
  placeholder?: string;
  isDark?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * @file ProductSearchCombobox.tsx
 * @description Relevance-Weighted Hardware Product Search Combobox with Instant Prefix Ranking
 * and Multi-Tier Dimension, Price, and Alphabetical Sorting Controls.
 */
export const ProductSearchCombobox: React.FC<ProductSearchComboboxProps> = ({
  products,
  onSelectProduct,
  placeholder,
  isDark = true,
  autoFocus = false,
  disabled = false,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isSinhala = i18n.language === 'si';

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [sortMode, setSortMode] = useState<'relevance' | 'dimension' | 'price' | 'alphabetical'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Relevance-ranked search results with optional explicit sort override ──
  const filteredProducts = useMemo(() => {
    if (!query.trim()) return [];

    const ranked = rankSearchResults(
      products,
      query,
      (item) => ({
        name: item.name,
        nameAlt: item.nameSinhala || item.nameSi || item.name,
        searchKey: item.searchKey,
        barcode: item.barcode,
        size: (item as any).size,
        no: item.no,
        price: item.salesPrice,
        category: item.productCategory,
      })
    );

    if (sortMode === 'dimension') {
      const sorted = [...ranked];
      sorted.sort((a, b) => {
        const cmp = naturalDimensionComparator(a, b, (item) => item.name);
        return sortOrder === 'asc' ? cmp : -cmp;
      });
      return sorted;
    } else if (sortMode === 'price') {
      const sorted = [...ranked];
      sorted.sort((a, b) => {
        const priceA = Number(a.salesPrice || 0);
        const priceB = Number(b.salesPrice || 0);
        return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
      });
      return sorted;
    } else if (sortMode === 'alphabetical') {
      const sorted = [...ranked];
      sorted.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        const cmp = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'asc' ? cmp : -cmp;
      });
      return sorted;
    }

    return ranked;
  }, [products, query, sortMode, sortOrder]);

  // Handle outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // Reset selected index when results list updates
  useEffect(() => {
    setSelectedIndex(filteredProducts.length > 0 ? 0 : -1);
  }, [filteredProducts]);

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = useCallback((item: InventoryProduct) => {
    onSelectProduct(item, 1);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  }, [onSelectProduct]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredProducts.length === 0) {
      if (e.key === 'ArrowDown' && filteredProducts.length > 0) {
        setIsOpen(true);
        setSelectedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredProducts.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredProducts.length) {
          handleSelect(filteredProducts[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('quickCheckout.searchPlaceholder', 'Search products, dimensions (e.g. 1/2), barcodes...')}
          className={`w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-medium border-2 rounded-xl focus:outline-none transition-all ${
            isDark
              ? 'bg-slate-800/90 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
              : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${
              isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && query.trim() && (
        <div
          ref={listRef}
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border shadow-2xl overflow-hidden backdrop-blur-md animate-fade-in flex flex-col max-h-[65vh] ${
            isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
          }`}
        >
          {/* Header Bar with Result Count and Quick Sort Toggles */}
          <div className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 text-[10px] flex-shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <div className="flex items-center gap-1.5 font-semibold">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                isDark ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'bg-white text-amber-600 border border-slate-200 shadow-xs'
              }`}>
                {filteredProducts.length}
              </span>
              <span>{filteredProducts.length === 1 ? 'item' : 'items'} found</span>
            </div>

            {/* Quick Sort Controls [ Dimension | Price | Name ] */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] uppercase tracking-wider opacity-60 mr-0.5">Sort:</span>

              {/* Dimension Sort Toggle */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sortMode === 'dimension') {
                    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setSortMode('dimension');
                    setSortOrder('asc');
                  }
                  inputRef.current?.focus();
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                  sortMode === 'dimension'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-xs'
                    : isDark
                      ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="Sort naturally by Hardware Dimension"
              >
                <Ruler className="w-3 h-3 text-amber-400" />
                <span>Dimension</span>
                {sortMode === 'dimension' && (
                  <span className="text-[8px] font-mono ml-0.5">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>

              {/* Price Sort Toggle */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sortMode === 'price') {
                    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setSortMode('price');
                    setSortOrder('asc');
                  }
                  inputRef.current?.focus();
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                  sortMode === 'price'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-xs'
                    : isDark
                      ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="Sort by Price"
              >
                <Banknote className="w-3 h-3 text-emerald-400" />
                <span>Price</span>
                {sortMode === 'price' && (
                  <span className="text-[8px] font-mono ml-0.5">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>

              {/* Name Sort Toggle */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sortMode === 'alphabetical') {
                    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setSortMode('alphabetical');
                    setSortOrder('asc');
                  }
                  inputRef.current?.focus();
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                  sortMode === 'alphabetical'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-xs'
                    : isDark
                      ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="Sort Alphabetically"
              >
                <ArrowDownAZ className="w-3 h-3 text-blue-400" />
                <span>Name</span>
                {sortMode === 'alphabetical' && (
                  <span className="text-[8px] font-mono ml-0.5">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </div>
          </div>

          {/* Results List */}
          {filteredProducts.length > 0 ? (
            <div className="p-1 space-y-0.5 overflow-y-auto max-h-[calc(65vh-36px)] custom-scrollbar">
              {filteredProducts.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const displayName = isSinhala
                  ? (item.nameSinhala || item.nameSi || item.name)
                  : item.name;
                const stock = Number(item.storeQty || 0);

                return (
                  <div
                    key={item.id}
                    data-index={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all cursor-pointer border-l-4 ${
                      isSelected
                        ? isDark
                          ? 'bg-slate-800 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                          : 'bg-amber-50 border-amber-500 shadow-sm ring-1 ring-amber-200'
                        : isDark
                          ? 'border-transparent hover:bg-slate-800/60 text-slate-200'
                          : 'border-transparent hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/20'
                          : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Package className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <ProductNameTooltip name={item.name} nameSinhala={item.nameSinhala} nameSi={item.nameSi}>
                          <p className={`text-xs font-semibold truncate ${
                            isSelected ? (isDark ? 'text-white' : 'text-amber-950') : isDark ? 'text-slate-100' : 'text-slate-900'
                          }`}>
                            {displayName}
                          </p>
                        </ProductNameTooltip>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {item.searchKey}
                          </span>
                          {item.barcode && (
                            <>
                              <span className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>•</span>
                              <span className={`text-[9px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {item.barcode}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        stock > 10
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : stock > 0
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {stock} {t('invoice.units', 'in stock')}
                      </span>

                      <div className="text-right min-w-[70px]">
                        <p className={`text-xs font-bold font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                          Rs. {Number(item.salesPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Package className={`w-8 h-8 mx-auto mb-2 opacity-40 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('quickCheckout.noProductsFound', 'No products found')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductSearchCombobox;
