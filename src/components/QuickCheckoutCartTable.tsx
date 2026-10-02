import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Plus, X } from 'lucide-react';
import ProductNameTooltip from './ProductNameTooltip';
import { encodeCostToSecretCode } from '../lib/secretCostCode';

export interface QuickInvoiceItem {
  id: string;
  productId?: string;
  productName: string;
  productNameSi?: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  total: number;
  cost?: number;
  lastPrice?: number;
  salesPrice?: number;
  displayPrice?: number;
  ourPrice?: number;
  storeQty?: number;
}

interface QuickCheckoutCartTableProps {
  items: QuickInvoiceItem[];
  isDark: boolean;
  isSinhala: boolean;
  isCartFocused: boolean;
  selectedCartIndex: number;
  isQuickAddMode: boolean;
  setIsQuickAddMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  setIsCartFocused: (val: boolean) => void;
  setSelectedCartIndex: (val: number) => void;
  setCurrentMode: (mode: any) => void;
  removeItem: (id: string) => void;
  updateItemQuantity: (id: string, qty: number) => void;
  commitCartItemPrice: (id: string) => void;
  cartListRef: React.RefObject<HTMLDivElement>;
  cartItemsContainerRef: React.RefObject<HTMLDivElement>;
  cartItemRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  getGridTemplateColumns: () => string;
  getResizeHandlerProps: (key: string) => any;
  editingCell: { itemId: string; field: 'salesPrice' | 'quantity' } | null;
  setEditingCell: (val: { itemId: string; field: 'salesPrice' | 'quantity' } | null) => void;
  inlineEditStr: string;
  setInlineEditStr: (val: string) => void;
  inlineEditInputRef: React.RefObject<HTMLInputElement>;
  parseQuantityInput: (val: string) => number;
  toTwoDecimals: (val: number) => number;
  quickAddNameRef: React.RefObject<HTMLInputElement>;
  quickAddPriceRef: React.RefObject<HTMLInputElement>;
  quickAddDisplayPriceRef: React.RefObject<HTMLInputElement>;
  quickAddQtyRef: React.RefObject<HTMLInputElement>;
  quickAddName: string;
  setQuickAddName: (val: string) => void;
  quickAddPriceStr: string;
  setQuickAddPriceStr: (val: string) => void;
  quickAddDisplayPriceStr: string;
  setQuickAddDisplayPriceStr: (val: string) => void;
  quickAddQtyStr: string;
  setQuickAddQtyStr: (val: string) => void;
  quickAddFocusField: 'name' | 'price' | 'displayPrice' | 'qty';
  setQuickAddFocusField: (field: 'name' | 'price' | 'displayPrice' | 'qty') => void;
  addQuickAddItem: () => void;
  playBeep: (type: 'add' | 'remove' | 'error' | 'success') => void;
  formatCartPrice: (val: number | string | undefined | null) => string;
}

export const QuickCheckoutCartTable: React.FC<QuickCheckoutCartTableProps> = ({
  items,
  isDark,
  isSinhala,
  isCartFocused,
  selectedCartIndex,
  isQuickAddMode,
  setIsQuickAddMode,
  setIsCartFocused,
  setSelectedCartIndex,
  setCurrentMode,
  removeItem,
  updateItemQuantity,
  commitCartItemPrice,
  cartListRef,
  cartItemsContainerRef,
  cartItemRefs,
  getGridTemplateColumns,
  getResizeHandlerProps,
  editingCell,
  setEditingCell,
  inlineEditStr,
  setInlineEditStr,
  inlineEditInputRef,
  parseQuantityInput,
  toTwoDecimals,
  quickAddNameRef,
  quickAddPriceRef,
  quickAddDisplayPriceRef,
  quickAddQtyRef,
  quickAddName,
  setQuickAddName,
  quickAddPriceStr,
  setQuickAddPriceStr,
  quickAddDisplayPriceStr,
  setQuickAddDisplayPriceStr,
  quickAddQtyStr,
  setQuickAddQtyStr,
  quickAddFocusField,
  setQuickAddFocusField,
  addQuickAddItem,
  playBeep,
  formatCartPrice,
}) => {
  const { t } = useTranslation();

  return (
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
          ? isDark
            ? 'bg-slate-800/50 border-amber-500/50 ring-1 ring-amber-500/20'
            : 'bg-slate-50 border-amber-400 ring-1 ring-amber-200 shadow'
          : isDark
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-slate-50 border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className={`font-bold flex items-center gap-1.5 text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <ShoppingCart className="w-4 h-4" />
          {t('quickCheckout.cartItems')} ({items.length})
          {isCartFocused && (
            <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
              {"↑↓ → ← 0-9"}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setIsQuickAddMode((prev) => !prev);
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
            <kbd className={`ml-0.5 px-1 py-0.5 rounded text-[8px] font-mono ${isQuickAddMode ? 'bg-white/20 text-white' : isDark ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>F8</kbd>
          </button>
          <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>F4</kbd>
          <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>F9</kbd>
        </div>
      </div>

      {isQuickAddMode && (
        <div className={`mb-2 p-2 rounded-lg border ${isDark ? 'bg-teal-500/10 border-teal-500/50 ring-1 ring-teal-500/20' : 'bg-teal-50 border-teal-400 ring-1 ring-teal-200'}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Plus className={`w-3 h-3 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            <span className={`text-xs font-semibold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{t('quickCheckout.quickAddTitle')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={quickAddNameRef}
              type="text"
              placeholder={t('quickCheckout.itemName')}
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setQuickAddFocusField('name'); }}
              className={`flex-[2] min-w-[50px] px-2 py-1.5 text-xs border rounded-lg focus:outline-none ${quickAddFocusField === 'name' ? (isDark ? 'border-teal-500 bg-slate-700 text-white ring-1 ring-teal-500/30' : 'border-teal-500 bg-white text-slate-900 ring-1 ring-teal-200') : (isDark ? 'border-slate-600 bg-slate-700/50 text-white' : 'border-slate-200 bg-white text-slate-900')}`}
            />
            <div className="w-[96px]">
              <input
                ref={quickAddPriceRef}
                type="text"
                inputMode="decimal"
                placeholder="Sales Price"
                value={quickAddPriceStr}
                onChange={(e) => setQuickAddPriceStr(e.target.value)}
                onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setQuickAddFocusField('price'); }}
                className={`w-full px-2 py-1.5 text-xs text-right border rounded-lg focus:outline-none ${quickAddFocusField === 'price' ? (isDark ? 'border-teal-500 bg-slate-700 text-white ring-1 ring-teal-500/30' : 'border-teal-500 bg-white text-slate-900 ring-1 ring-teal-200') : (isDark ? 'border-slate-600 bg-slate-700/50 text-white' : 'border-slate-200 bg-white text-slate-900')}`}
              />
            </div>
            <div className="w-[96px]">
              <input
                ref={quickAddDisplayPriceRef}
                type="text"
                inputMode="decimal"
                placeholder="Display Price"
                value={quickAddDisplayPriceStr}
                onChange={(e) => setQuickAddDisplayPriceStr(e.target.value)}
                onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setQuickAddFocusField('displayPrice'); }}
                className={`w-full px-2 py-1.5 text-xs text-right border rounded-lg focus:outline-none ${quickAddFocusField === 'displayPrice' ? (isDark ? 'border-teal-500 bg-slate-700 text-white ring-1 ring-teal-500/30' : 'border-teal-500 bg-white text-slate-900 ring-1 ring-teal-200') : (isDark ? 'border-slate-600 bg-slate-700/50 text-white' : 'border-slate-200 bg-white text-slate-900')}`}
              />
            </div>
            <div className="w-[80px]">
              <input
                ref={quickAddQtyRef}
                type="text"
                inputMode="decimal"
                placeholder={t('quickCheckout.qty')}
                value={quickAddQtyStr}
                onChange={(e) => setQuickAddQtyStr(e.target.value)}
                onFocus={() => { setIsCartFocused(false); setSelectedCartIndex(-1); setQuickAddFocusField('qty'); }}
                className={`w-full px-2 py-1.5 text-xs text-center border rounded-lg focus:outline-none ${quickAddFocusField === 'qty' ? (isDark ? 'border-teal-500 bg-slate-700 text-white ring-1 ring-teal-500/30' : 'border-teal-500 bg-white text-slate-900 ring-1 ring-teal-200') : (isDark ? 'border-slate-600 bg-slate-700/50 text-white' : 'border-slate-200 bg-white text-slate-900')}`}
              />
            </div>
            <button
              type="button"
              onClick={addQuickAddItem}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium ${quickAddName && parseQuantityInput(quickAddPriceStr) > 0 ? 'bg-teal-500 hover:bg-teal-600 text-white' : isDark ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
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
          <div
            className={`grid px-2 py-2.5 mb-1 rounded-lg text-xs font-black uppercase tracking-wider select-none ${isDark ? 'text-slate-400 bg-slate-800/50' : 'text-slate-500 bg-slate-100'}`}
            style={{ gridTemplateColumns: getGridTemplateColumns() }}
          >
            <div className="truncate relative group/header">Product<span {...getResizeHandlerProps('product')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} /></div>
            <div className="text-right truncate relative group/header">Cost<span {...getResizeHandlerProps('cost')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} /></div>
            <div className="text-right truncate relative group/header">Last<span {...getResizeHandlerProps('last')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} /></div>
            <div className="text-right truncate relative group/header">Sales<span {...getResizeHandlerProps('sales')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} /></div>
            <div className="text-right truncate relative group/header">Display<span {...getResizeHandlerProps('display')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} /></div>
            <div className="text-center truncate relative group/header">Stock<span {...getResizeHandlerProps('stock')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} /></div>
            <div className="text-center truncate relative group/header">Qty<span {...getResizeHandlerProps('qty')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} /></div>
            <div className="text-right truncate relative group/header">Subtotal<span {...getResizeHandlerProps('subtotal')} className={`absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] transition-colors ${isDark ? 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/30' : 'bg-transparent hover:bg-amber-500 group-hover/header:bg-slate-400/40'}`} /></div>
          </div>
          <div ref={cartItemsContainerRef} className="space-y-1 h-[280px] overflow-y-auto">
            {items.map((item, index) => {
              const ourPrice = Number(item.salesPrice || item.ourPrice || 0);
              const displayPrice = Number(item.displayPrice || 0);
              const lastPrice = Number(item.lastPrice || 0);

              return (
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
                    setCurrentMode('cart');
                    if (document.activeElement instanceof HTMLInputElement) {
                      document.activeElement.blur();
                    }
                    cartListRef.current?.focus();
                    playBeep('add');
                  }}
                  className={`grid items-center px-2 py-2.5 rounded-lg transition-all cursor-pointer outline-none relative group ${
                    isCartFocused && index === selectedCartIndex
                      ? isDark ? 'bg-amber-500/20 shadow ring-1 ring-amber-500/50' : 'bg-amber-50 shadow ring-1 ring-amber-400/50'
                      : isDark ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                  style={{ gridTemplateColumns: getGridTemplateColumns() }}
                >
                  <div className="min-w-0 truncate">
                    <ProductNameTooltip name={item.productName} nameSinhala={item.productNameSi}>
                      <p className={`text-sm font-semibold truncate leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {isSinhala ? (item.productNameSi || item.productName) : item.productName}
                      </p>
                    </ProductNameTooltip>
                  </div>
                  <div className="text-right truncate">
                    <span title={`Cost: Rs. ${formatCartPrice(item.cost)}`} className={`text-sm font-mono font-bold tracking-wider ${isDark ? 'text-amber-400/80' : 'text-slate-600'}`}>
                      {encodeCostToSecretCode(item.cost)}
                    </span>
                  </div>
                  <div className="text-right truncate">
                    <span className={`text-sm font-mono font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatCartPrice(lastPrice)}
                    </span>
                  </div>
                  <div className="text-right truncate">
                    {editingCell?.itemId === item.id && editingCell?.field === 'salesPrice' ? (
                      <input
                        ref={inlineEditInputRef}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        className={`w-20 font-bold text-right rounded border px-1.5 py-1 focus:outline-none text-sm font-mono tabular-nums ${
                          isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500 ring-1 ring-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-400 ring-1 ring-amber-200'
                        }`}
                        value={inlineEditStr}
                        onChange={(e) => setInlineEditStr(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitCartItemPrice(item.id);
                          }
                        }}
                        onBlur={() => commitCartItemPrice(item.id)}
                      />
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ itemId: item.id, field: 'salesPrice' });
                          setInlineEditStr(String(ourPrice));
                        }}
                        className={`cursor-pointer hover:bg-amber-500/10 rounded px-1 -mx-1 transition-colors text-sm font-mono font-bold tabular-nums ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                      >
                        {formatCartPrice(ourPrice)}
                      </span>
                    )}
                  </div>
                  <div className="text-right truncate">
                    {ourPrice > displayPrice ? (
                      <span className={`text-sm font-mono line-through opacity-40 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formatCartPrice(displayPrice)}
                      </span>
                    ) : (
                      <span className={`text-sm font-bold font-mono ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                        {formatCartPrice(displayPrice)}
                      </span>
                    )}
                  </div>
                  <div className="text-center truncate">
                    <span className={`text-sm font-mono font-semibold ${item.storeQty !== undefined && item.storeQty < 10 ? 'text-amber-500 font-bold animate-pulse' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {item.storeQty !== undefined && item.storeQty !== null ? item.storeQty : '-'}
                    </span>
                  </div>
                  <div className="flex justify-center items-center">
                    {editingCell?.itemId === item.id && editingCell?.field === 'quantity' ? (
                      <input
                        ref={inlineEditInputRef}
                        type="text"
                        inputMode="decimal"
                        className={`w-16 font-bold text-center rounded border py-1 focus:outline-none text-sm tabular-nums ${
                          isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500 ring-1 ring-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-400 ring-1 ring-amber-200'
                        }`}
                        value={inlineEditStr}
                        onChange={(e) => setInlineEditStr(e.target.value)}
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
                        className={`cursor-pointer hover:bg-amber-500/10 rounded px-1.5 -mx-1.5 transition-colors text-sm font-bold font-mono tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}
                      >
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  <div className="text-right pr-2 truncate">
                    <span className={`text-sm font-bold font-mono tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {formatCartPrice(ourPrice * item.quantity)}
                    </span>
                  </div>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 z-10">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                      className="p-0.5 rounded text-red-500 hover:bg-red-500/10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};