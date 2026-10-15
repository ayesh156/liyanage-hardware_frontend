import React from 'react';
import { useTranslation } from 'react-i18next';
import { Supplier } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  MoreVertical, PackagePlus, Banknote, Edit2, Trash2, Building2, BookOpen 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '../../lib/utils';

export interface SupplierRowActionMenuProps {
  /** Supplier data object */
  supplier: Supplier;
  /** Triggered to open create GRN modal preselected with this supplier */
  onAddGrn: (supplierId: string) => void;
  /** Triggered to open settlement modal for this supplier */
  onSettle: (supplier: Supplier) => void;
  /** Triggered to open comprehensive supplier ledger modal */
  onViewLedger: (supplier: Supplier) => void;
  /** Triggered to open supplier edit modal */
  onEdit: (supplier: Supplier) => void;
  /** Triggered to delete this supplier */
  onDelete: (supplier: Supplier) => void;
}

/**
 * High-performance Floating Portal Action Menu for Supplier table rows.
 * 
 * Renders cleanly outside table DOM via Radix React Portal (`z-[9999]`) to completely
 * prevent table row height distortion and clipping.
 */
export const SupplierRowActionMenu: React.FC<SupplierRowActionMenuProps> = ({
  supplier,
  onAddGrn,
  onSettle,
  onViewLedger,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'p-1.5 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-orange-500/40',
            isDark
              ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white'
              : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
          )}
          title={t('common.actions', 'Supplier Actions')}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className={cn(
          'z-[9999] w-56 p-1.5 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          isDark
            ? 'bg-slate-900/95 border-slate-700 text-slate-200'
            : 'bg-white/95 border-slate-200 text-slate-800'
        )}
      >
        <div className={cn("px-2.5 py-1.5 border-b mb-1", isDark ? "border-slate-800/50" : "border-slate-200")}>
          <p className={cn("text-[11px] font-bold truncate", isDark ? "text-slate-200" : "text-slate-900")}>{supplier.name}</p>
          <p className={cn("text-[10px] truncate", isDark ? "text-slate-400" : "text-slate-500")}>
            {supplier.companyName || 'Hardware Supplier'}
          </p>
        </div>

        {/* View Supplier Ledger */}
        <DropdownMenuItem
          onClick={() => onViewLedger(supplier)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            isDark
              ? "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900"
          )}
        >
          <BookOpen className={cn("w-4 h-4", isDark ? "text-amber-400" : "text-amber-600")} />
          <span>{t('supplierLedger.title', 'Supplier Ledger')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onAddGrn(supplier.id)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            isDark
              ? "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900"
          )}
        >
          <PackagePlus className={cn("w-4 h-4", isDark ? "text-cyan-400" : "text-cyan-600")} />
          <span>{t('supplierLedger.newGrn', 'New GRN')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onSettle(supplier)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            isDark
              ? "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900"
          )}
        >
          <Banknote className={cn("w-4 h-4", isDark ? "text-emerald-400" : "text-emerald-600")} />
          <span>{t('grn.pendingGrns', 'Pending GRNs')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onEdit(supplier)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            isDark
              ? "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900"
          )}
        >
          <Edit2 className={cn("w-4 h-4", isDark ? "text-orange-400" : "text-orange-600")} />
          <span>{t('suppliers.editSupplier', 'Edit Supplier')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className={isDark ? 'bg-slate-800/80 my-1' : 'bg-slate-200 my-1'} />

        <DropdownMenuItem
          onClick={() => onDelete(supplier)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            isDark
              ? "text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 focus:bg-rose-500/20 focus:text-rose-300"
              : "text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50 focus:text-rose-700"
          )}
        >
          <Trash2 className={cn("w-4 h-4", isDark ? "text-rose-400" : "text-rose-600")} />
          <span>{t('suppliers.deleteSupplier', 'Delete Supplier')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SupplierRowActionMenu;
