import React from 'react';
import { useTranslation } from 'react-i18next';
import { GRN } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  MoreVertical, Edit2, Banknote, Trash2, History, CreditCard 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '../../lib/utils';

export interface GRNRowActionMenuProps {
  /** GRN data object */
  grn: GRN;
  /** Triggered to open comprehensive GRN Form Modal in edit mode */
  onEdit: (grn: GRN) => void;
  /** Triggered to open settlement history modal for this GRN */
  onViewSettlements: (grn: GRN) => void;
  /** Triggered to open quick payment modal for this GRN */
  onSettle: (grn: GRN) => void;
  /** Triggered to delete this GRN */
  onDelete: (grn: GRN) => void;
}

/**
 * Floating Portal Action Menu for Goods Received Note (GRN) table rows.
 * 
 * Uses Radix React Portal (`z-[9999]`) preventing clipping or distortion across overflow containers.
 */
export const GRNRowActionMenu: React.FC<GRNRowActionMenuProps> = ({
  grn,
  onEdit,
  onViewSettlements,
  onSettle,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const due = Number(grn.dueAmount || 0);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'p-1.5 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/40',
            isDark
              ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white'
              : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
          )}
          title="GRN Actions"
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
          <p className={cn("text-[11px] font-mono font-bold", isDark ? "text-cyan-400" : "text-cyan-700")}>#{grn.grnNumber}</p>
          <p className={cn("text-[10px] truncate", isDark ? "text-slate-400" : "text-slate-500")}>
            {grn.supplier?.name || 'Supplier Goods Receipt'}
          </p>
        </div>

        {/* Direct Edit GRN */}
        <DropdownMenuItem
          onClick={() => onEdit(grn)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            isDark
              ? "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900"
          )}
        >
          <Edit2 className={cn("w-4 h-4", isDark ? "text-cyan-400" : "text-cyan-600")} />
          <span>{t('grn.editGrn', 'Edit GRN')}</span>
        </DropdownMenuItem>

        {/* Row-Level Settlement History */}
        <DropdownMenuItem
          onClick={() => onViewSettlements(grn)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            isDark
              ? "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900"
          )}
        >
          <History className={cn("w-4 h-4", isDark ? "text-emerald-400" : "text-emerald-600")} />
          <span>{t('grn.settlementHistory', 'Settlement History')} ({grn.settlements?.length || 0})</span>
        </DropdownMenuItem>

        {/* Settle Due (if unpaid debt exists) */}
        {due > 0 && (
          <DropdownMenuItem
            onClick={() => onSettle(grn)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
              isDark
                ? "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900"
            )}
          >
            <Banknote className={cn("w-4 h-4", isDark ? "text-amber-400" : "text-amber-600")} />
            <span>{t('grn.payBill', 'Pay Bill')} (Rs. {due.toFixed(2)})</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className={isDark ? 'bg-slate-800/80 my-1' : 'bg-slate-200 my-1'} />

        {/* Delete GRN */}
        <DropdownMenuItem
          onClick={() => onDelete(grn)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors",
            isDark
              ? "text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 focus:bg-rose-500/20 focus:text-rose-300"
              : "text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50 focus:text-rose-700"
          )}
        >
          <Trash2 className={cn("w-4 h-4", isDark ? "text-rose-400" : "text-rose-600")} />
          <span>{t('grn.deleteGrn', 'Delete GRN')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default GRNRowActionMenu;
