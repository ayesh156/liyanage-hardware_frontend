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
        <div className="px-2.5 py-1.5 border-b border-slate-800/50 mb-1">
          <p className="text-[11px] font-mono font-bold text-cyan-400">#{grn.grnNumber}</p>
          <p className="text-[10px] text-slate-400 truncate">
            {grn.supplier?.name || 'Supplier Goods Receipt'}
          </p>
        </div>

        {/* Direct Edit GRN */}
        <DropdownMenuItem
          onClick={() => onEdit(grn)}
          className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-cyan-500/15 hover:text-cyan-400 focus:bg-cyan-500/15 focus:text-cyan-400 transition-colors"
        >
          <Edit2 className="w-4 h-4 text-cyan-400" />
          <span>{t('grn.editGrn', 'Edit GRN')}</span>
        </DropdownMenuItem>

        {/* Row-Level Settlement History */}
        <DropdownMenuItem
          onClick={() => onViewSettlements(grn)}
          className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-emerald-500/15 hover:text-emerald-400 focus:bg-emerald-500/15 focus:text-emerald-400 transition-colors"
        >
          <History className="w-4 h-4 text-emerald-400" />
          <span>{t('grn.settlementHistory', 'Settlement History')} ({grn.settlements?.length || 0})</span>
        </DropdownMenuItem>

        {/* Settle Due (if unpaid debt exists) */}
        {due > 0 && (
          <DropdownMenuItem
            onClick={() => onSettle(grn)}
            className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-amber-500/15 hover:text-amber-400 focus:bg-amber-500/15 focus:text-amber-400 transition-colors"
          >
            <Banknote className="w-4 h-4 text-amber-400" />
            <span>{t('grn.payBill', 'Pay Bill')} (Rs. {due.toFixed(2)})</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className={isDark ? 'bg-slate-800/80 my-1' : 'bg-slate-200 my-1'} />

        {/* Delete GRN */}
        <DropdownMenuItem
          onClick={() => onDelete(grn)}
          className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 focus:bg-rose-500/15 focus:text-rose-300 transition-colors"
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>{t('grn.deleteGrn', 'Delete GRN')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default GRNRowActionMenu;
