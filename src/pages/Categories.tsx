import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/use-mobile';
import { useCatalog } from '../contexts/CatalogContext';
import { mockCategories, inventoryItems, linkedCatalogItems } from '../data/mockData';
import { Category } from '../types/index';
import { CategoryFormModal } from '../components/modals/CategoryFormModal';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';
import { CellPopover } from '../components/CellPopover';
import { 
  Plus, Search, Edit2, Trash2, FolderTree, Package, Layers, Tag,
  RefreshCw, Pencil, X,
  ChevronLeft, ChevronRight as ChevronRightIcon,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';
import SortButton from '../components/ui/SortButton';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export const Categories: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';

  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // ── Cell Popover state — for text fields (name, nameAlt, description) ──
  const [cellPopover, setCellPopover] = useState<{
    category: Category;
    field: 'name' | 'nameAlt' | 'description';
    anchorRect: DOMRect;
  } | null>(null);

  // ── DYNAMIC USAGE COUNTER: Counts inventoryItems by categoryId — single source of truth ──
  const getUsageCount = useCallback((categoryId: string, categoryName: string) => {
    // Strategy 1: Match by FK categoryId (all 150 inventory items have proper categoryId)
    const countById = inventoryItems.filter(p => p.categoryId === categoryId).length;
    if (countById > 0) return countById;
    // Strategy 2: Fallback — match by productCategory name (case-insensitive, normalized)
    const normalizedCatName = categoryName.trim().toLowerCase();
    return inventoryItems.filter(p =>
      p.productCategory.trim().toLowerCase() === normalizedCatName
    ).length;
  }, []);

  // Check if category has active filters
  const hasActiveFilters = searchQuery.length > 0;

  // Filter and sort categories (flat — no parent filter)
  const filteredCategories = useMemo(() => {
    return categories
      .filter(cat => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return cat.name.toLowerCase().includes(q) ||
          (cat.nameAlt && cat.nameAlt.includes(q)) ||
          (cat.description && cat.description.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [categories, searchQuery, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredCategories.length / rowsPerPage);
  const paginatedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredCategories.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredCategories, currentPage, rowsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOrder, rowsPerPage]);

  // Stats — use live getUsageCount for accurate live totals
  const totalCategories = categories.length;
  const categoriesWithProducts = categories.filter(cat => getUsageCount(cat.id, cat.name) > 0).length;
  const totalLiveUsage = categories.reduce((s, c) => s + getUsageCount(c.id, c.name), 0);

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setIsFormModalOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setIsFormModalOpen(true);
  };

  const handleDeleteCategory = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteModalOpen(true);
  };

  const handleSaveCategory = (categoryData: Partial<Category>) => {
    if (selectedCategory) {
      setCategories(prev => prev.map(cat => 
        cat.id === selectedCategory.id ? { ...cat, ...categoryData } : cat
      ));
    } else {
      const newCategory: Category = {
        id: `cat-${String(categories.length + 1).padStart(3, '0')}`,
        name: categoryData.name || '',
        nameAlt: categoryData.nameAlt,
        icon: categoryData.icon,
        description: categoryData.description,
      };
      setCategories(prev => [...prev, newCategory]);
    }
    setIsFormModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (selectedCategory) {
      setCategories(prev => prev.filter(cat => cat.id !== selectedCategory.id));
    }
    setIsDeleteModalOpen(false);
    setSelectedCategory(null);
  };

  // ── Popover cell save handler ──
  const handleCellSave = useCallback((category: Category, field: string, value: string | number) => {
    setCategories(prev => prev.map(cat => 
      cat.id === category.id ? { ...cat, [field]: String(value) } : cat
    ));
    setCellPopover(null);
  }, []);

  // ── Open cell popover from click event ──
  const openCellPopover = useCallback((
    category: Category,
    field: 'name' | 'nameAlt' | 'description',
    e: React.MouseEvent
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCellPopover({ category, field, anchorRect: rect });
  }, []);

  // Calculate pagination info
  const startItem = (currentPage - 1) * rowsPerPage + 1;
  const endItem = Math.min(currentPage * rowsPerPage, filteredCategories.length);

  return (
    <div className={`space-y-4 ${isMobile ? 'pb-20' : ''}`}>
      {/* ── Floating Cell Popover (for text fields: name, nameAlt, description) ── */}
      {cellPopover && (
        <CellPopover
          value={cellPopover.category[cellPopover.field] || ''}
          fieldLabel={cellPopover.field === 'name' ? 'Category Name' : cellPopover.field === 'nameAlt' ? 'Alt Name' : 'Description'}
          type="text"
          anchorRect={cellPopover.anchorRect}
          onSave={(val) => handleCellSave(cellPopover.category, cellPopover.field, val)}
          onClose={() => setCellPopover(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Product Category
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('categories.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleAddCategory}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-lg font-medium transition-all shadow shadow-orange-500/20 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('categories.addCategory')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { icon: FolderTree, gradient: 'from-blue-500/20 to-cyan-500/20', color: 'text-blue-400', value: totalCategories, label: t('categories.totalCategories') },
          { icon: Package, gradient: 'from-emerald-500/20 to-teal-500/20', color: 'text-emerald-400', value: categoriesWithProducts, label: t('categories.withProducts') },
          { icon: Tag, gradient: 'from-amber-500/20 to-orange-500/20', color: 'text-amber-400', value: totalLiveUsage, label: t('categories.totalUsage') },
          { icon: Layers, gradient: 'from-purple-500/20 to-pink-500/20', color: 'text-purple-400', value: Math.round(totalLiveUsage / Math.max(totalCategories, 1)), label: t('categories.avgUsage') },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient}`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{item.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar (flat — no type or parent filter, just search + sort) ── */}
      <div className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xl">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <input type="text"
              placeholder={t('categories.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-9 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all ${
                isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200'
              }`}
            />
            {searchQuery.length > 0 && (
              <button onClick={() => setSearchQuery('')}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'}`}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <SortButton currentSortOrder={sortOrder} onSortToggle={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')} />
          <span className={`text-[10px] font-medium ml-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {filteredCategories.length} categories
          </span>
        </div>
      </div>

      {/* ── FLAT TABLE (no Parent Category column) ── */}
      <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-900/95 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className={isDark ? 'bg-slate-800/80' : 'bg-slate-50'}>
              <tr>
                {[
                  { label: t('tableHeaders.category'), align: 'left' as const },
                  { label: t('categories.sinhalaName'), align: 'left' as const },
                  { label: t('common.description'), align: 'left' as const },
                  { label: t('categories.usage'), align: 'right' as const },
                  { label: t('common.actions'), align: 'center' as const },
                ].map((col, i) => (
                  <th key={i}
                    className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/40' : 'divide-slate-200'}`}>
              {paginatedCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <FolderTree className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {searchQuery ? 'No categories match your search' : 'No categories yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((category) => (
                  <tr key={category.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/25' : 'hover:bg-slate-50'}`}>
                    {/* Name */}
                    <td
                      className="px-2 py-1.5 relative group cursor-pointer"
                      onClick={(e) => openCellPopover(category, 'name', e)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-rose-500/20 flex-shrink-0">
                          <FolderTree className="w-3 h-3 text-orange-400" />
                        </div>
                        <span className={`text-[11px] font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {category.name}
                        </span>
                      </div>
                      <span className={`absolute -right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        <Pencil className="w-3 h-3" />
                      </span>
                    </td>

                    {/* Alt Name */}
                    <td
                      className="px-2 py-1.5 relative group cursor-pointer"
                      onClick={(e) => openCellPopover(category, 'nameAlt', e)}
                    >
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {category.nameAlt || '-'}
                      </span>
                      <span className={`absolute -right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        <Pencil className="w-3 h-3" />
                      </span>
                    </td>

                    {/* Description */}
                    <td
                      className="px-2 py-1.5 relative group cursor-pointer"
                      onClick={(e) => openCellPopover(category, 'description', e)}
                    >
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'} line-clamp-1`}>
                        {category.description || '-'}
                      </span>
                      <span className={`absolute -right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        <Pencil className="w-3 h-3" />
                      </span>
                    </td>

                    {/* Usage Count */}
                    <td className="px-2 py-1.5 text-right">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                        isDark
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        <Package className="w-2.5 h-2.5" />
                        {getUsageCount(category.id, category.name)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => handleEditCategory(category)}
                          className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-90 ${
                            isDark ? 'text-slate-400 hover:text-orange-400 hover:bg-orange-500/15' : 'text-slate-500 hover:text-orange-600 hover:bg-orange-50'
                          }`} title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteCategory(category)}
                          className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-90 ${
                            isDark ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/15' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                          }`} title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── ADVANCED PAGINATION ── */}
        {filteredCategories.length > 0 && (
          <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDark ? 'border-slate-700/40' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Showing {startItem}-{endItem} of {filteredCategories.length}
              </span>
              <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span>Rows:</span>
                <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className={`px-1.5 py-0.5 text-[10px] border rounded transition-colors focus:outline-none focus:ring-1 focus:ring-orange-500/50 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}>
                  {ROWS_PER_PAGE_OPTIONS.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                className={`p-1.5 rounded transition-colors disabled:opacity-30 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`} title="First page">
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className={`p-1.5 rounded transition-colors disabled:opacity-30 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`} title="Previous page">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                const page = start + i;
                if (page > totalPages) return null;
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 text-[10px] font-semibold rounded transition-all ${
                      page === currentPage
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                        : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}>{page}</button>
                );
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className={`p-1.5 rounded transition-colors disabled:opacity-30 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`} title="Next page">
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                className={`p-1.5 rounded transition-colors disabled:opacity-30 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`} title="Last page">
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CategoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveCategory}
        category={selectedCategory}
        categories={categories}
      />
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t('categories.deleteCategory')}
        message={t('categories.deleteConfirmationMessage', { name: selectedCategory?.name })}
      />
    </div>
  );
};

export default Categories;