import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/use-mobile';
import { mockProducts, mockCategories } from '../data/mockData';
import { Product, Category } from '../types';
import { 
  ArrowLeft, 
  Printer, 
  Package, 
  Tag, 
  Plus, 
  Minus, 
  Trash2, 
  X,
  Barcode,
  ScanLine,
  Settings2,
  Layers,
  ShoppingCart
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { SearchableSelect, SearchableSelectOption } from '../components/ui/searchable-select';
import { toast } from 'sonner';

// ============================================================================
// CODE39 BARCODE GENERATOR - Scannable barcode SVG renderer
// ============================================================================
const CODE39_MAP: Record<string, string> = {
  '0': 'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
  'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
  'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
  'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn','Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','$':'nwnwnwnnn','/':'nwnwnnnwn','+':'nwnnnwnwn','%':'nnnwnwnwn','*':'nwnnwnwnn'
};

interface BarcodeProps {
  value: string;
  height?: number;
  narrow?: number;
  wide?: number;
  margin?: number;
}

const Code39Barcode: React.FC<BarcodeProps> = ({ value, height = 50, narrow = 1.5, wide = 4, margin = 4 }) => {
  const text = `*${String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '')}*`;

  let x = 0;
  const bars: React.ReactNode[] = [];

  const appendPattern = (pattern: string, charIndex: number) => {
    for (let i = 0; i < pattern.length; i++) {
      const isBar = i % 2 === 0;
      const w = pattern[i] === 'n' ? narrow : wide;
      if (isBar) {
        bars.push(
          <rect key={`bar-${charIndex}-${i}-${x}`} x={x} y={0} width={w} height={height} fill="#000" />
        );
      }
      x += w;
    }
    x += narrow;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const pattern = CODE39_MAP[ch] || CODE39_MAP['-'];
    appendPattern(pattern, i);
  }

  const totalWidth = x + margin * 2;

  return (
    <svg width={totalWidth} height={height + margin * 2} viewBox={`0 0 ${totalWidth} ${height + margin * 2}`} role="img" aria-label={`Barcode for ${value}`}>
      <rect x={0} y={0} width={totalWidth} height={height + margin * 2} fill="#fff" />
      <g transform={`translate(${margin}, ${margin})`}>
        {bars}
      </g>
    </svg>
  );
};

// Generate Code39 barcode as SVG string for print
const generateCode39SVG = (value: string, height: number = 50, narrow: number = 1.5, wide: number = 4, margin: number = 4): string => {
  const text = `*${String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '')}*`;

  let x = 0;
  const bars: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const pattern = CODE39_MAP[ch] || CODE39_MAP['-'];
    
    for (let j = 0; j < pattern.length; j++) {
      const isBar = j % 2 === 0;
      const w = pattern[j] === 'n' ? narrow : wide;
      if (isBar) {
        bars.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000"/>`);
      }
      x += w;
    }
    x += narrow;
  }

  const totalWidth = x + margin * 2;

  return `<svg width="${totalWidth}" height="${height + margin * 2}" viewBox="0 0 ${totalWidth} ${height + margin * 2}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${totalWidth}" height="${height + margin * 2}" fill="#fff"/><g transform="translate(${margin}, ${margin})">${bars.join('')}</g></svg>`;
};

// ============================================================================
// INTERFACES
// ============================================================================

interface LabelConfig {
  labelHeight: 'compact' | 'standard' | 'large';
  showPrice: boolean;
  showSku: boolean;
  showCategory: boolean;
}

interface Entry {
  id: string;
  product: Product;
  variant?: Product['variants'][number];
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
}

interface SelectedEntry {
  entry: Entry;
  quantity: number;
}

interface CategoryGroup {
  category: Category | null;
  categoryName: string;
  products: SelectedEntry[];
  totalLabels: number;
}

const DEFAULT_CONFIG: LabelConfig = {
  labelHeight: 'standard',
  showPrice: true,
  showSku: true,
  showCategory: false,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BarcodeLabels: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const printRef = useRef<HTMLDivElement>(null);

  // State
  const [products] = useState<Product[]>(mockProducts);
  const [categories] = useState<Category[]>(mockCategories);
  const [selectedEntries, setSelectedEntries] = useState<Map<string, SelectedEntry>>(new Map());
  const [labelConfig, setLabelConfig] = useState<LabelConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [productSelectValue, setProductSelectValue] = useState<string>('');

  const isDark = theme === 'dark';

  // Get category name by ID
  const getCategoryName = useCallback((categoryId?: string): string => {
    if (!categoryId) return t('barcodeLabels.uncategorized');
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || categoryId;
  }, [categories, t]);

  // Flatten products into selectable entries (variant-level). Each entry has exactly one barcode (if present)
  const entries = useMemo(() => {
    const list: Entry[] = [];
    products.forEach(product => {
      if (product.hasVariants && product.variants && product.variants.length > 0) {
        product.variants.forEach(variant => {
          if (!variant.isActive) return;
          const labelParts: string[] = [];
          if (variant.size) labelParts.push(variant.size);
          if (variant.color) labelParts.push(variant.color);
          const name = labelParts.length ? `${product.name} (${labelParts.join(' - ')})` : `${product.name} (${variant.sku})`;
          list.push({
            id: `${product.id}__${variant.id}`,
            product,
            variant,
            name,
            sku: variant.sku,
            barcode: variant.barcode,
            categoryId: product.categoryId || product.category,
          });
        });
      } else {
        list.push({
          id: product.id,
          product,
          variant: undefined,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          categoryId: product.categoryId || product.category,
        });
      }
    });
    return list;
  }, [products]);

  const entriesWithBarcodes = useMemo(() => entries.filter(e => e.barcode), [entries]);
  const countEntriesWithBarcodes = entriesWithBarcodes.length;

  // SearchableSelect options for entries (variants and standalone products)
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return entriesWithBarcodes.map(entry => ({
      value: entry.id,
      label: `${entry.name} (${entry.sku})`,
      icon: <Barcode className="w-4 h-4 text-indigo-500" />,
      count: 1,
      disabled: selectedEntries.has(entry.id),
    }));
  }, [entriesWithBarcodes, selectedEntries]);

  // Handle product selection from SearchableSelect
  const handleEntrySelect = useCallback((entryId: string) => {
    if (!entryId || selectedEntries.has(entryId)) return;

    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    if (!entry.barcode) {
      toast.error(t('barcodeLabels.noBarcode'));
      return;
    }

    setSelectedEntries(prev => {
      const newMap = new Map(prev);
      newMap.set(entry.id, {
        entry,
        quantity: 1,
      });
      return newMap;
    });

    setProductSelectValue('');
    toast.success(`${entry.name} ${t('barcodeLabels.added')}`);
  }, [entries, selectedEntries, t]);

  // Update label quantity for a product
  const updateQuantity = useCallback((entryId: string, delta: number) => {
    setSelectedEntries(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(entryId);
      if (item) {
        const newQty = Math.max(1, Math.min(100, item.quantity + delta));
        newMap.set(entryId, { ...item, quantity: newQty });
      }
      return newMap;
    });
  }, []);

  // Set exact quantity
  const setQuantity = useCallback((entryId: string, quantity: number) => {
    setSelectedEntries(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(entryId);
      if (item) {
        const newQty = Math.max(1, Math.min(100, quantity));
        newMap.set(entryId, { ...item, quantity: newQty });
      }
      return newMap;
    });
  }, []);

  // Remove entry from selection
  const removeEntry = useCallback((entryId: string) => {
    setSelectedEntries(prev => {
      const newMap = new Map(prev);
      newMap.delete(entryId);
      return newMap;
    });
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedEntries(new Map());
    toast.info(t('barcodeLabels.selectionCleared'));
  }, [t]);

  // Calculate total labels
  const totalLabels = useMemo(() => {
    let total = 0;
    selectedEntries.forEach(item => {
      total += item.quantity;
    });
    return total;
  }, [selectedEntries]);

  // Organize labels by category for printing
  const labelGroups = useMemo((): CategoryGroup[] => {
    const groups = new Map<string, CategoryGroup>();

    selectedEntries.forEach(item => {
      const catKey = item.entry.categoryId || item.entry.product.categoryId || item.entry.product.category || 'other';

      if (!groups.has(catKey)) {
        const category = categories.find(c => c.id === catKey) || null;
        groups.set(catKey, {
          category,
          categoryName: getCategoryName(catKey),
          products: [],
          totalLabels: 0,
        });
      }

      const group = groups.get(catKey)!;
      group.products.push(item);
      group.totalLabels += item.quantity;
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName)
    );
  }, [selectedEntries, categories, getCategoryName]);

  // Print labels
  const handlePrint = useCallback(() => {
    if (selectedEntries.size === 0) {
      toast.error(t('barcodeLabels.noProductsSelected'));
      return;
    }
    setIsPrintPreview(true);
  }, [selectedEntries.size, t]);

  // Execute print with 3-column A4 layout and real Code39 barcodes
  const executePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('barcodeLabels.printBlocked'));
      return;
    }

    const labelHeightPx = labelConfig.labelHeight === 'compact' ? '78px' : 
                          labelConfig.labelHeight === 'standard' ? '98px' : '118px';

    // Generate all label HTML with real Code39 barcodes
    let labelsHTML = '';
    
    labelGroups.forEach(group => {
      labelsHTML += `<div class="category-section">`;
      labelsHTML += `<div class="category-header">${group.categoryName} (${group.totalLabels} labels)</div>`;
      labelsHTML += `<div class="labels-grid">`;
      
      group.products.forEach(({ entry, quantity }) => {
        const barcode = entry.barcode || '';
        if (!barcode) return;
        for (let i = 0; i < quantity; i++) {
          const barcodeSVG = generateCode39SVG(barcode, 38, 1.2, 3.5, 2);

          labelsHTML += `
            <div class="label-item" style="height: ${labelHeightPx}">
              <div class="product-name">${entry.name}</div>
              <div class="barcode-container">
                ${barcodeSVG}
                <div class="barcode-text">${barcode}</div>
              </div>
              ${labelConfig.showPrice ? `<div class="price">Rs. ${(entry.product.retailPrice || entry.product.price || 0).toLocaleString()}</div>` : ''}
              ${labelConfig.showSku ? `<div class="sku">${entry.sku}</div>` : ''}
              ${labelConfig.showCategory ? `<div class="category-tag">${group.categoryName}</div>` : ''}
            </div>
          `;
        }
      });
      
      labelsHTML += `</div></div>`;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${t('barcodeLabels.printTitle')}</title>
        <style>
          @page {
            size: A4;
            margin: 6mm; /* reduced margin to fit more labels */
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            font-size: 10px;
            line-height: 1.18;
            background: #fff;
          }
          
          .category-section {
            margin-bottom: 8px;
            page-break-inside: avoid;
          }
          
          /* Simple black section title with bottom rule */
          .category-header {
            color: #0f172a;
            padding: 4px 6px;
            margin-bottom: 6px;
            font-weight: 700;
            font-size: 11px;
            border-bottom: 1px solid #0f172a;
          }
          
          .labels-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }
          
          /* Tighter label spacing to fit more rows on A4 */
          .label-item {
            width: calc(33.333% - 3px);
            border: 1px dashed #e5e7eb;
            border-radius: 4px;
            padding: 3px 2px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            overflow: hidden;
            page-break-inside: avoid;
            background: #fff;
          }
          
          .product-name {
            font-weight: 700;
            font-size: 9px;
            margin-bottom: 4px;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.05;
            color: #0f172a;
            padding: 0 2px; /* small horizontal inset so text doesn't touch border */
          }
          
          .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            margin: 2px 0;
          }
          
          .barcode-container svg {
            max-width: 100%;
            height: auto;
            max-height: 34px; /* slightly smaller to free vertical space */
          }
          
          .barcode-text {
            font-family: 'Courier New', monospace;
            font-size: 8.5px;
            margin-top: 2px;
            letter-spacing: 1.2px;
            font-weight: 500;
            color: #374151;
          }
          
          .price {
            font-weight: bold;
            font-size: 12px;
            color: #059669;
            margin-top: 3px;
          }
          
          .sku {
            font-size: 8px;
            color: #6b7280;
            margin-top: 1px;
          }
          
          .category-tag {
            font-size: 7px;
            background: #e5e7eb;
            padding: 2px 6px;
            border-radius: 3px;
            color: #4b5563;
            margin-top: 2px;
          }
          
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${labelsHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);

    setIsPrintPreview(false);
    toast.success(t('barcodeLabels.printSuccess'));
  }, [labelConfig, labelGroups, t]);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'} ${isMobile ? 'pb-24' : ''}`}>
      {/* Header - Compact on mobile */}
      <div className={`sticky top-0 z-40 ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} ${isDark ? 'bg-slate-800/95 backdrop-blur border-b border-slate-700' : 'bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm'}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/products')}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30`}>
                <ScanLine className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
              </div>
              <div>
                <h1 className={`${isMobile ? 'text-base' : 'text-xl'} font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('barcodeLabels.title')}
                </h1>
                {!isMobile && (
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('barcodeLabels.subtitle')}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            {totalLabels > 0 && (
              <Badge variant="secondary" className={`gap-1 ${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1.5'} bg-indigo-500/20 text-indigo-600 dark:text-indigo-400`}>
                <Tag className={`${isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                {totalLabels}
              </Badge>
            )}
            
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-lg transition-colors ${
                showConfig 
                  ? 'bg-indigo-500 text-white' 
                  : isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
              }`}
              title={t('barcodeLabels.settings')}
            >
              <Settings2 className="w-5 h-5" />
            </button>
            
            {/* Print button - hidden on mobile (floating button used instead) */}
            {!isMobile && (
              <Button
                onClick={handlePrint}
                disabled={selectedEntries.size === 0}
                className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                <Printer className="w-4 h-4" />
                {t('barcodeLabels.print')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto ${isMobile ? 'px-3 py-3' : 'p-4'}`}>
        {/* Configuration Panel - Collapsible on mobile */}
        {showConfig && (
          <div className={`mb-4 ${isMobile ? 'p-3' : 'p-4'} rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h3 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'} ${isMobile ? 'text-sm' : ''}`}>
              <Settings2 className="w-4 h-4" />
              {t('barcodeLabels.labelSettings')}
            </h3>
            <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 md:grid-cols-4 gap-4'}`}>
              {/* Label height */}
              <div>
                <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('barcodeLabels.labelHeight')}
                </label>
                <Select
                  value={labelConfig.labelHeight}
                  onValueChange={(v) => setLabelConfig(prev => ({ ...prev, labelHeight: v as 'compact' | 'standard' | 'large' }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">{t('barcodeLabels.compact')}</SelectItem>
                    <SelectItem value="standard">{t('barcodeLabels.standard')}</SelectItem>
                    <SelectItem value="large">{t('barcodeLabels.large')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Show price toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPrice"
                  checked={labelConfig.showPrice}
                  onChange={(e) => setLabelConfig(prev => ({ ...prev, showPrice: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <label htmlFor="showPrice" className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('barcodeLabels.showPrice')}
                </label>
              </div>
              
              {/* Show SKU toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showSku"
                  checked={labelConfig.showSku}
                  onChange={(e) => setLabelConfig(prev => ({ ...prev, showSku: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <label htmlFor="showSku" className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('barcodeLabels.showSku')}
                </label>
              </div>
              
              {/* Show category toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showCategory"
                  checked={labelConfig.showCategory}
                  onChange={(e) => setLabelConfig(prev => ({ ...prev, showCategory: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <label htmlFor="showCategory" className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('barcodeLabels.showCategoryOnLabel')}
                </label>
              </div>
            </div>
            
            {/* Layout info */}
            <div className={`mt-3 p-2 rounded-lg text-xs ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <strong>{t('barcodeLabels.layoutInfo')}:</strong> 3 {t('barcodeLabels.columnsPerPage')} (A4)
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Panel - Product Selection with SearchableSelect */}
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h3 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <ShoppingCart className="w-4 h-4" />
                {t('barcodeLabels.selectProducts')}
              </h3>
              
              {/* SearchableSelect for product selection */}
              <div className="mb-4">
                <SearchableSelect
                  options={productOptions}
                  value={productSelectValue}
                  onValueChange={handleEntrySelect}
                  placeholder={t('barcodeLabels.searchAndSelect')}
                  searchPlaceholder={t('barcodeLabels.searchProducts')}
                  emptyMessage={t('barcodeLabels.noProductsWithBarcode')}
                  theme={isDark ? 'dark' : 'light'}
                />
              </div>
              
              {/* Stats */}
              <div className={`flex items-center justify-between text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span>{countEntriesWithBarcodes} {t('barcodeLabels.productsWithBarcodes')}</span>
                {selectedEntries.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="text-red-500 hover:text-red-600 text-xs flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    {t('barcodeLabels.clearAll')}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Add - Recently used or popular products */}
            <div className={`${isMobile ? 'p-3' : 'p-4'} rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('barcodeLabels.quickAdd')}
              </h4>
              <div className={`flex flex-wrap ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
                {entriesWithBarcodes.slice(0, isMobile ? 6 : 8).map(entry => {
                  const isSelected = selectedEntries.has(entry.id);
                  return (
                    <button
                      key={entry.id}
                      onClick={() => !isSelected && handleEntrySelect(entry.id)}
                      disabled={isSelected}
                      className={`${isMobile ? 'px-2.5 py-2 text-xs' : 'px-3 py-1.5 text-xs'} rounded-lg font-medium transition-all active:scale-95 ${
                        isSelected
                          ? isDark ? 'bg-indigo-500/30 text-indigo-300 cursor-not-allowed' : 'bg-indigo-100 text-indigo-600 cursor-not-allowed'
                          : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 active:bg-slate-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300'
                      }`}
                    >
                      {entry.name.length > (isMobile ? 15 : 20) ? entry.name.slice(0, isMobile ? 15 : 20) + '...' : entry.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel - Selected Products & Quantities */}
          <div className="space-y-4">
            <div className={`rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className={`${isMobile ? 'px-3 py-2.5' : 'px-4 py-3'} border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'} ${isMobile ? 'text-sm' : ''}`}>
                  <Layers className="w-4 h-4" />
                  {t('barcodeLabels.selectedProducts')} ({selectedEntries.size})
                </h3>
              </div>
              
              <div className={`${isMobile ? 'max-h-[350px]' : 'max-h-[500px]'} overflow-y-auto`}>
                {selectedEntries.size === 0 ? (
                  <div className={`${isMobile ? 'p-6' : 'p-8'} text-center`}>
                    <Tag className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('barcodeLabels.noSelection')}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-3">
                    {Array.from(selectedEntries.values()).map(({ entry, quantity }) => (
                      <div
                        key={entry.id}
                        className={`${isMobile ? 'p-3' : 'p-4'} rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'} truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {entry.name}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              SKU: {entry.sku}
                            </p>
                          </div>
                          <button
                            onClick={() => removeEntry(entry.id)}
                            className={`${isMobile ? 'p-2' : 'p-1.5'} rounded-lg transition-colors active:scale-95 ${isDark ? 'hover:bg-red-500/20 active:bg-red-500/30 text-red-400' : 'hover:bg-red-100 active:bg-red-200 text-red-500'}`}
                          >
                            <Trash2 className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                          </button>
                        </div>
                        
                        {/* Barcode preview - smaller on mobile */}
                        <div className={`${isMobile ? 'mb-2' : 'mb-3'} rounded-lg ${isDark ? 'bg-white' : 'bg-white border border-slate-200'} flex items-center justify-center px-2 py-1.5`} style={{ minHeight: isMobile ? 50 : 64 }}>
                          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                            <Code39Barcode value={entry.barcode} height={isMobile ? 28 : 35} narrow={isMobile ? 0.8 : 1} wide={isMobile ? 2.5 : 3} margin={1} />
                            <p className={`text-center ${isMobile ? 'text-[10px]' : 'text-xs'} font-mono text-slate-600 mt-0.5`}>{entry.barcode}</p>
                          </div>
                        </div>
                        
                        {/* Quantity controls - larger touch targets on mobile */}
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {t('barcodeLabels.labelsQty')}:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantity(entry.id, -1)}
                              className={`${isMobile ? 'p-2.5' : 'p-1.5'} rounded-lg transition-colors active:scale-95 ${isDark ? 'hover:bg-slate-700 active:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 active:bg-slate-300 text-slate-600'}`}
                            >
                              <Minus className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={quantity}
                              onChange={(e) => setQuantity(entry.id, parseInt(e.target.value) || 1)}
                              className={`${isMobile ? 'w-14 px-1.5 py-2 text-base' : 'w-16 px-2 py-1.5 text-sm'} text-center font-bold rounded-lg border ${
                                isDark 
                                  ? 'bg-slate-700 border-slate-600 text-white' 
                                  : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                            <button
                              onClick={() => updateQuantity(entry.id, 1)}
                              className={`${isMobile ? 'p-2.5' : 'p-1.5'} rounded-lg transition-colors active:scale-95 ${isDark ? 'hover:bg-slate-700 active:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 active:bg-slate-300 text-slate-600'}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Total labels for this product */}
                        <div className={`mt-2 pt-2 border-t text-xs text-right ${isDark ? 'border-slate-700 text-indigo-400' : 'border-slate-200 text-indigo-600'}`}>
                          {quantity} = <strong>{quantity} {t('barcodeLabels.labels')}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Summary Footer */}
              {selectedEntries.size > 0 && (
                <div className={`${isMobile ? 'px-3 py-3' : 'px-4 py-4'} border-t ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium ${isMobile ? 'text-sm' : ''} ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('barcodeLabels.totalLabels')}:
                    </span>
                    <span className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-indigo-500`}>
                      {totalLabels}
                    </span>
                  </div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('barcodeLabels.estimatedPages')}: ~{Math.ceil(totalLabels / 21)} {t('barcodeLabels.pages')} (3×7 per page)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Preview Modal - Full screen on mobile */}
      {isPrintPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`w-full ${isMobile ? 'h-full max-h-full rounded-none' : 'max-w-4xl max-h-[90vh] m-4 rounded-2xl'} overflow-auto ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`sticky top-0 ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} border-b flex items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} z-10`}>
              <h3 className={`font-semibold ${isMobile ? 'text-sm' : ''} ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('barcodeLabels.printPreview')}
              </h3>
              <div className="flex items-center gap-2">
                <Button onClick={executePrint} className={`gap-2 ${isMobile ? 'h-9 px-3 text-sm' : ''}`}>
                  <Printer className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                  {isMobile ? t('barcodeLabels.print') : t('barcodeLabels.confirmPrint')}
                </Button>
                <Button variant="outline" onClick={() => setIsPrintPreview(false)} className={isMobile ? 'h-9 w-9 p-0' : ''}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Preview Content */}
            <div className={`${isMobile ? 'p-3' : 'p-6'} bg-white`}>
              {labelGroups.map(group => (
                <div key={group.categoryName} className="mb-6">
                  <div className="text-black px-1 pb-2 mb-3 text-sm font-semibold border-b border-slate-300">
                    {group.categoryName} ({group.totalLabels} {t('barcodeLabels.labels')})
                  </div>
                  <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                    {group.products.flatMap(({ entry, quantity }) => 
                      Array.from({ length: Math.min(quantity, isMobile ? 2 : 3) }).map((_, idx) => (
                        <div 
                          key={`${entry.id}-${idx}`}
                          className={`border border-dashed border-slate-300 rounded-md ${isMobile ? 'px-1.5 py-1' : 'px-2 py-1'} flex flex-col items-center text-center`}
                        >
                          <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold text-slate-800 w-full ${isMobile ? 'mb-1' : 'mb-2'}`} style={{ display: '-webkit-box' as any, WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                            {entry.name}
                          </p>
                          <Code39Barcode value={entry.barcode} height={isMobile ? 28 : 36} narrow={isMobile ? 0.8 : 1} wide={isMobile ? 2.5 : 3} margin={1} />
                          <p className={`${isMobile ? 'text-[9px]' : 'text-xs'} font-mono text-slate-600 mt-0.5`}>{entry.barcode}</p>
                          {labelConfig.showPrice && (
                            <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-emerald-600 mt-0.5`}>
                              Rs. {(entry.product.retailPrice || entry.product.price || 0).toLocaleString()}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {group.totalLabels > (isMobile ? 4 : 9) && (
                    <p className="text-xs text-slate-400 text-center mt-2">
                      +{group.totalLabels - Math.min(group.products.reduce((acc, p) => acc + Math.min(p.quantity, isMobile ? 2 : 3), 0), isMobile ? 4 : 9)} more labels...
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button */}
      {isMobile && selectedEntries.size > 0 && !isPrintPreview && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-50">
          <Button
            onClick={handlePrint}
            className="w-full h-14 gap-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-2xl shadow-indigo-500/40 rounded-2xl text-base font-semibold"
          >
            <Printer className="w-5 h-5" />
            {t('barcodeLabels.print')} ({totalLabels} {t('barcodeLabels.labels')})
          </Button>
        </div>
      )}
    </div>
  );
};

export default BarcodeLabels;
