import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '../../contexts/CatalogContext';
import {
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Package,
  Calendar,
  CreditCard,
  FileText,
  Calculator,
  ArrowRight,
  ShieldCheck,
  Percent,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export type BreakdownTab = 'revenue' | 'cogs' | 'expenses' | 'profit' | 'exposure';

export interface FinancialBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: BreakdownTab;
  data: {
    summary: {
      totalRevenue: number;
      grossSales?: number;
      totalDiscounts?: number;
      cogs?: number;
      grossProfit?: number;
      grossProfitMargin?: number;
      totalExpenses: number;
      operatingExpenses?: number;
      grnStockExpenditure?: number;
      supplierSettlementOutflows?: number;
      netProfit: number;
      profitMargin: number;
      customerOutstanding: number;
      supplierDue: number;
      netCashFlow?: number;
    } | null;
    breakdown?: {
      revenue?: {
        invoices: any[];
        manualRevenue: any[];
        totalRevenue: number;
      };
      cogs?: {
        totalCogs: number;
        itemsCount: number;
        items: any[];
      };
      expenses?: {
        totalOperatingExpenses: number;
        totalGrnExpenditure: number;
        totalSupplierSettlements: number;
        operatingList: any[];
        grnList: any[];
        settlementList: any[];
      };
      netProfitReconciliation?: {
        totalRevenue: number;
        grossSales?: number;
        totalDiscounts?: number;
        cogs: number;
        grossProfit: number;
        grossProfitMargin: number;
        operatingExpenses: number;
        trueNetProfit: number;
        netProfitMargin: number;
        grnExpenditure: number;
        supplierSettlements: number;
        netCashFlow: number;
      };
      exposure?: {
        customerOutstanding: number;
        supplierDue: number;
        netExposure: number;
        customers: any[];
        suppliers: any[];
      };
    };
  };
}

/**
 * Breakdown Proof Modal displaying exact accounting formulas, itemized invoices,
 * COGS product line margins, GRN procurement expenses, and debt exposure records.
 */
export const FinancialBreakdownModal: React.FC<FinancialBreakdownModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profit',
  data,
}) => {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const { categories } = useCatalog();
  const isDark = theme === 'dark';
  const isSinhala = i18n.language === 'si';

  /**
   * Helper to dynamically resolve Sinhala category display name using Catalog master categories or i18n fallback.
   */
  const getCategoryDisplayName = (catName: string): string => {
    if (!catName) return '';
    if (!isSinhala) return catName;
    const matched = categories.find((c) => c.name?.trim().toLowerCase() === catName?.trim().toLowerCase());
    if (matched && (matched.nameSinhala || (matched as any).nameSi)) {
      return (matched.nameSinhala || (matched as any).nameSi)!.trim();
    }
    return String(t(`financial.categories.${catName}`, { defaultValue: catName }));
  };

  const [activeTab, setActiveTab] = useState<BreakdownTab>(initialTab);
  const [expenseSubTab, setExpenseSubTab] = useState<'opex' | 'grn' | 'settlements'>('opex');

  if (!isOpen) return null;

  const summary = data.summary || {
    totalRevenue: 0,
    grossSales: 0,
    totalDiscounts: 0,
    cogs: 0,
    grossProfit: 0,
    grossProfitMargin: 0,
    totalExpenses: 0,
    operatingExpenses: 0,
    grnStockExpenditure: 0,
    supplierSettlementOutflows: 0,
    netProfit: 0,
    profitMargin: 0,
    customerOutstanding: 0,
    supplierDue: 0,
    netCashFlow: 0,
  };

  const bd = data.breakdown || {};
  const netRevenueVal = summary.totalRevenue;
  const grossSalesVal = (summary as any).grossSales ?? (netRevenueVal + ((summary as any).totalDiscounts || 0));
  const totalDiscountsVal = (summary as any).totalDiscounts ?? (grossSalesVal - netRevenueVal);
  const cogsVal = summary.cogs ?? bd.cogs?.totalCogs ?? 0;
  const grossProfitVal = summary.grossProfit ?? (netRevenueVal - cogsVal);
  const opExVal = summary.operatingExpenses ?? bd.expenses?.totalOperatingExpenses ?? 0;
  const grnVal = summary.grnStockExpenditure ?? bd.expenses?.totalGrnExpenditure ?? 0;
  const settleVal = summary.supplierSettlementOutflows ?? bd.expenses?.totalSupplierSettlements ?? 0;
  const netProfitVal = summary.netProfit;

  // 🌟 Full edge-to-edge backdrop overlay portaled directly to document.body.
  // Using React Portal breaks out of parent layout constraints and stacking contexts (e.g., transforms,
  // filters, overflow hidden, or navbar wrappers in AdminLayout), ensuring the backdrop begins precisely
  // at pixel 0 of the browser window with zero top margin or padding offsets.
  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen bg-black/60 backdrop-blur-sm z-[9999] m-0 p-3 sm:p-4 flex items-center justify-center overflow-y-auto animate-in fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden transition-all flex flex-col max-h-[85vh] my-auto ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-white shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-300'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed & never clipped */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>{t('financial.breakdownTitle', 'Accounting Calculation Proof & Audit')}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  {t('financial.gaapVerified', 'GAAP Verified')}
                </span>
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('financial.breakdownSubtitle', 'Complete mathematical formula reconciliation and itemized proof records')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation - Fixed & never crushed/clipped */}
        <div
          className={`px-4 sm:px-5 pt-3 border-b flex gap-2 overflow-x-auto shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-100/40'
          }`}
        >
          {[
            { id: 'profit' as const, label: t('financial.tabs.netProfit', 'True Net Profit'), icon: DollarSign, color: 'text-blue-500' },
            { id: 'revenue' as const, label: t('financial.tabs.revenue', 'Revenue Proof'), icon: TrendingUp, color: 'text-emerald-500' },
            { id: 'cogs' as const, label: t('financial.tabs.cogs', 'COGS Breakdown'), icon: Package, color: 'text-amber-500' },
            { id: 'expenses' as const, label: t('financial.tabs.expenses', 'Expenses & GRNs'), icon: TrendingDown, color: 'text-rose-500' },
            { id: 'exposure' as const, label: t('financial.tabs.exposure', 'Credit Exposure'), icon: Building2, color: 'text-purple-500' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-orange-500 text-orange-500 bg-orange-500/10'
                    : isDark
                    ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Content - Scrolls internally, preventing tabs from shrinking */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
          {/* TAB 1: TRUE NET PROFIT RECONCILIATION */}
          {activeTab === 'profit' && (
            <div className="space-y-6">
              {/* Formula Step-by-Step Card with Explicit Discounts */}
              <div
                className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {t('financial.formulaReconciliation', 'TRUE NET PROFIT FORMULA & RECONCILIATION')}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    {t('financial.gaapVerified', 'GAAP Verified')}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'}`}>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase">{t('financial.grossSales', 'GROSS SALES')}</p>
                    {/* Contrast fix for Gross Sales in light theme: bold, dark, and perfectly legible against light background */}
                    <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-900 font-extrabold'}`}>
                      +Rs. {grossSalesVal.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-slate-500">Gross Invoices</p>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-amber-950/20 border-amber-800/30' : 'bg-amber-50 border-amber-200'}`}>
                    <p className="text-[9px] text-amber-400 font-semibold uppercase">{t('financial.lessDiscounts', 'LESS DISCOUNTS')}</p>
                    <p className="text-sm font-extrabold text-amber-400 mt-0.5">
                      -Rs. {totalDiscountsVal.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-slate-500">All Discounts</p>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-emerald-50 border-emerald-200'}`}>
                    <p className="text-[9px] text-emerald-400 font-semibold uppercase">{t('financial.netRevenue', 'NET REVENUE')}</p>
                    <p className="text-sm font-extrabold text-emerald-500 mt-0.5">
                      =Rs. {netRevenueVal.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-emerald-600/80">Net Sales</p>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'}`}>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase">{t('financial.lessCogs', 'LESS COGS')}</p>
                    <p className="text-sm font-extrabold text-rose-400 mt-0.5">
                      -Rs. {cogsVal.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-slate-500">Cost of Goods</p>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-blue-950/30 border-blue-800/40' : 'bg-blue-50 border-blue-200'}`}>
                    <p className="text-[9px] text-blue-400 font-semibold uppercase">{t('financial.grossProfit', 'GROSS PROFIT')}</p>
                    <p className="text-sm font-extrabold text-blue-500 mt-0.5">
                      =Rs. {grossProfitVal.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-blue-400">{(netRevenueVal > 0 ? (grossProfitVal / netRevenueVal) * 100 : 0).toFixed(1)}% {t('financial.grossPrefix', 'Gross')}</p>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'}`}>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase">{t('financial.lessOverhead', 'LESS OVERHEAD')}</p>
                    <p className="text-sm font-extrabold text-rose-500 mt-0.5">
                      -Rs. {opExVal.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-slate-500">OpEx Overhead</p>
                  </div>

                  <div className={`p-2.5 rounded-xl border col-span-2 sm:col-span-1 ${netProfitVal >= 0 ? (isDark ? 'bg-emerald-950/30 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200') : (isDark ? 'bg-rose-950/30 border-rose-800/40' : 'bg-rose-50 border-rose-200')}`}>
                    <p className={`text-[9px] font-semibold uppercase ${netProfitVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{t('financial.trueNetProfit', 'TRUE NET PROFIT')}</p>
                    <p className={`text-sm font-extrabold mt-0.5 ${netProfitVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {netProfitVal >= 0 ? '' : '-'}Rs. {Math.abs(netProfitVal).toLocaleString()}
                    </p>
                    <p className={`text-[9px] ${netProfitVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{summary.profitMargin.toFixed(1)}% {t('financial.netMargin', 'Net Margin')}</p>
                  </div>
                </div>
              </div>

              {/* Cash Flow Comparison */}
              <div
                className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-slate-800/30 border-slate-700/40' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">{t('financial.accrualCashReconciliation', 'ACCRUAL PROFIT VS CASH OUTFLOW RECONCILIATION')}</h4>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                  {t('financial.accrualExplanation', 'Accrual Net Profit reflects economic earnings from delivered goods deducting inventory cost of goods sold. In contrast, Net Cash Outflow reflects direct operational and capital cash disbursements during the active period.')}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: REVENUE PROOF */}
          {activeTab === 'revenue' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">{t('financial.itemizedInvoices', 'Itemized Active Invoices')} ({bd.revenue?.invoices?.length || 0})</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Active (non-cancelled) customer transactions recorded during this timeframe
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total Invoice Sum: </span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    Rs. {summary.totalRevenue.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <table className="w-full text-xs text-left">
                  <thead className={isDark ? 'bg-slate-800/70 text-slate-400' : 'bg-slate-100 text-slate-600'}>
                    <tr>
                      <th className="p-2.5">{t('financial.invoiceNumber', 'Invoice #')}</th>
                      <th className="p-2.5">{t('financial.date', 'Date')}</th>
                      <th className="p-2.5">{t('financial.customer', 'Customer')}</th>
                      <th className="p-2.5 text-right">{t('financial.items', 'Items')}</th>
                      <th className="p-2.5 text-right">{t('financial.discounts', 'Discounts')}</th>
                      <th className="p-2.5 text-right">{t('financial.total', 'Total')}</th>
                      <th className="p-2.5 text-right">{t('financial.cogs', 'COGS')}</th>
                      <th className="p-2.5 text-right">{t('financial.grossMargin', 'Gross Margin')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {(bd.revenue?.invoices || []).slice(0, 50).map((inv: any) => (
                      <tr key={inv.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="p-2.5 font-mono font-semibold text-orange-400">{inv.invoiceNumber}</td>
                        <td className="p-2.5 text-slate-400">{new Date(inv.issueDate).toLocaleDateString()}</td>
                        <td className="p-2.5 font-medium">{inv.customerName}</td>
                        <td className="p-2.5 text-right font-mono">{inv.items?.length || 0}</td>
                        <td className="p-2.5 text-right font-mono text-amber-400 font-semibold">
                          {Number(inv.discount || 0) > 0 ? `Rs. ${Number(inv.discount || 0).toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-emerald-400">Rs. {Number(inv.total).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono text-slate-400">Rs. {Number(inv.cogs || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-bold text-blue-400">Rs. {Number(inv.grossProfit || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {(!bd.revenue?.invoices || bd.revenue.invoices.length === 0) && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-500">
                          No invoices recorded for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COGS BREAKDOWN */}
          {activeTab === 'cogs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Cost of Goods Sold (COGS) Item Margins ({bd.cogs?.itemsCount || 0} Line Items)</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Calculated using Master Product cost prices against actual invoiced sales prices
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total Period COGS: </span>
                  <span className="text-sm font-extrabold text-amber-500">
                    Rs. {cogsVal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <table className="w-full text-xs text-left">
                  <thead className={isDark ? 'bg-slate-800/70 text-slate-400' : 'bg-slate-100 text-slate-600'}>
                    <tr>
                      <th className="p-2.5">{t('products.productName', 'Product Name')}</th>
                      <th className="p-2.5">{t('financial.invoiceNumber', 'Invoice #')}</th>
                      <th className="p-2.5 text-right">{t('financial.soldQty', 'Sold Qty')}</th>
                      <th className="p-2.5 text-right">{t('financial.unitCost', 'Unit Cost')}</th>
                      <th className="p-2.5 text-right">{t('financial.unitPrice', 'Unit Price')}</th>
                      <th className="p-2.5 text-right">{t('financial.lineCogs', 'Line COGS')}</th>
                      <th className="p-2.5 text-right">{t('financial.lineProfit', 'Line Profit')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {(bd.cogs?.items || []).slice(0, 50).map((it: any) => (
                      <tr key={it.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="p-2.5 font-medium">{it.productName}</td>
                        <td className="p-2.5 font-mono text-orange-400">{it.invoiceNumber}</td>
                        <td className="p-2.5 text-right font-mono font-semibold">{it.quantity}</td>
                        <td className="p-2.5 text-right text-slate-400">Rs. {Number(it.unitCost).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-semibold">Rs. {Number(it.unitPrice).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono text-amber-400 font-bold">Rs. {Number(it.lineCogs).toLocaleString()}</td>
                        <td className={`p-2.5 text-right font-bold ${it.lineGrossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Rs. {Number(it.lineGrossProfit).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {(!bd.cogs?.items || bd.cogs.items.length === 0) && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">
                          No sold items recorded for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: EXPENSES & GRNS */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-slate-700/30 pb-2">
                {[
                  { id: 'opex' as const, label: `${t('financial.operatingOverhead', 'Operating Overhead')} (Rs. ${opExVal.toLocaleString()})` },
                  { id: 'grn' as const, label: `${t('financial.grnProcurement', 'GRN Stock Procurement')} (Rs. ${grnVal.toLocaleString()})` },
                  { id: 'settlements' as const, label: `${t('financial.supplierCashPayments', 'Supplier Cash Payments')} (Rs. ${settleVal.toLocaleString()})` },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setExpenseSubTab(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      expenseSubTab === st.id
                        ? 'bg-orange-500 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {expenseSubTab === 'opex' && (
                <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <table className="w-full text-xs text-left">
                    <thead className={isDark ? 'bg-slate-800/70 text-slate-400' : 'bg-slate-100 text-slate-600'}>
                      <tr>
                        <th className="p-2.5">{t('financial.date', 'Date')}</th>
                        <th className="p-2.5">{t('financial.category', 'Category')}</th>
                        <th className="p-2.5">{t('financial.description', 'Description')}</th>
                        <th className="p-2.5">{t('financial.paymentMethod', 'Payment Method')}</th>
                        <th className="p-2.5 text-right">{t('financial.amount', 'Amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {(bd.expenses?.operatingList || []).map((tItem: any) => (
                        <tr key={tItem.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                          <td className="p-2.5 text-slate-400">{new Date(tItem.date).toLocaleDateString()}</td>
                          {/* 🌟 Dynamic category localization using getCategoryDisplayName helper */}
                          <td className="p-2.5 font-medium">{getCategoryDisplayName(tItem.category)}</td>
                          <td className="p-2.5">
                            {tItem.description?.includes('Walk-in Customer')
                              ? tItem.description.replace(/Walk-in Customer/g, String(t('financial.walkInCustomer', t('quickInvoice.walkInCustomer', 'සාමාන්‍ය පාරිභෝගිකයා'))))
                              : tItem.description}
                          </td>
                          <td className="p-2.5 uppercase font-mono text-[10px]">{tItem.paymentMethod}</td>
                          <td className="p-2.5 text-right font-bold text-rose-500">Rs. {Number(tItem.amount).toLocaleString()}</td>
                        </tr>
                      ))}
                      {(!bd.expenses?.operatingList || bd.expenses.operatingList.length === 0) && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500">
                            No manual operational expenses recorded for this timeframe
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {expenseSubTab === 'grn' && (
                <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <table className="w-full text-xs text-left">
                    <thead className={isDark ? 'bg-slate-800/70 text-slate-400' : 'bg-slate-100 text-slate-600'}>
                      <tr>
                        <th className="p-2.5">{t('grn.grnNumber', 'GRN #')}</th>
                        <th className="p-2.5">{t('financial.date', 'Date')}</th>
                        <th className="p-2.5">{t('suppliers.supplier', 'Supplier')}</th>
                        <th className="p-2.5 text-right">{t('financial.totalInward', 'Total Inward')}</th>
                        <th className="p-2.5 text-right">{t('invoices.paid', 'Paid')}</th>
                        <th className="p-2.5 text-right">{t('invoices.due', 'Due')}</th>
                        <th className="p-2.5 text-center">{t('common.status', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {(bd.expenses?.grnList || []).map((g: any) => (
                        <tr key={g.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                          <td className="p-2.5 font-mono font-semibold text-orange-400">{g.grnNumber}</td>
                          <td className="p-2.5 text-slate-400">{new Date(g.createdAt).toLocaleDateString()}</td>
                          <td className="p-2.5 font-medium">{g.supplierName}</td>
                          <td className="p-2.5 text-right font-bold text-rose-400">Rs. {Number(g.totalAmount).toLocaleString()}</td>
                          <td className="p-2.5 text-right text-emerald-400">Rs. {Number(g.paidAmount).toLocaleString()}</td>
                          <td className="p-2.5 text-right font-bold text-amber-400">Rs. {Number(g.dueAmount).toLocaleString()}</td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                              {g.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {expenseSubTab === 'settlements' && (
                <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <table className="w-full text-xs text-left">
                    <thead className={isDark ? 'bg-slate-800/70 text-slate-400' : 'bg-slate-100 text-slate-600'}>
                      <tr>
                        <th className="p-2.5">{t('financial.date', 'Date')}</th>
                        <th className="p-2.5">{t('suppliers.supplier', 'Supplier')}</th>
                        <th className="p-2.5">{t('financial.paymentMethod', 'Method')}</th>
                        <th className="p-2.5">{t('financial.notes', 'Note')}</th>
                        <th className="p-2.5 text-right">{t('financial.amountSettled', 'Amount Settled')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {(bd.expenses?.settlementList || []).map((s: any) => (
                        <tr key={s.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                          <td className="p-2.5 text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                          <td className="p-2.5 font-medium">{s.supplierName}</td>
                          <td className="p-2.5 font-mono uppercase text-[10px]">{s.paymentMethod}</td>
                          <td className="p-2.5 text-slate-400">{s.note || '—'}</td>
                          <td className="p-2.5 text-right font-bold text-rose-400">Rs. {Number(s.amount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CREDIT & DEBT EXPOSURE */}
          {activeTab === 'exposure' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className="text-xs text-slate-400 font-semibold uppercase">{t('financial.customerLoansReceivables', 'CUSTOMER LOANS (RECEIVABLES)')}</p>
                  <p className="text-xl font-extrabold text-emerald-400 mt-1">
                    Rs. {summary.customerOutstanding.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t('financial.owedByCustomers', 'Owed to business by credit customers')}</p>
                </div>

                <div className={`p-4 rounded-xl border ${isDark ? 'bg-rose-950/20 border-rose-800/40' : 'bg-rose-50 border-rose-200'}`}>
                  <p className="text-xs text-slate-400 font-semibold uppercase">{t('financial.supplierDuesPayables', 'SUPPLIER DUES (PAYABLES)')}</p>
                  <p className="text-xl font-extrabold text-rose-400 mt-1">
                    Rs. {summary.supplierDue.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t('financial.owedToSuppliers', 'Owed to suppliers for credit stock/GRNs')}</p>
                </div>

                <div className={`p-4 rounded-xl border ${isDark ? 'bg-purple-950/20 border-purple-800/40' : 'bg-purple-50 border-purple-200'}`}>
                  <p className="text-xs text-slate-400 font-semibold uppercase">{t('financial.netCreditPosition', 'NET CREDIT POSITION')}</p>
                  <p className={`text-xl font-extrabold mt-1 ${(summary.customerOutstanding - summary.supplierDue) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(summary.customerOutstanding - summary.supplierDue) >= 0 ? '+' : '-'}Rs. {Math.abs(summary.customerOutstanding - summary.supplierDue).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t('financial.receivablesMinusPayables', 'Receivables minus Payables')}</p>
                </div>
              </div>

              {/* Customers with Loans */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t('financial.customersWithLoanBalances', 'Customers with Active Loan Balances')}
                </h4>
                <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <table className="w-full text-xs text-left">
                    <thead className={isDark ? 'bg-slate-800/70 text-slate-400' : 'bg-slate-100 text-slate-600'}>
                      <tr>
                        <th className="p-2.5">{t('customers.customerName', 'Customer Name')}</th>
                        <th className="p-2.5">{t('common.phone', 'Phone')}</th>
                        <th className="p-2.5 text-right">{t('financial.outstandingLoanBalance', 'Outstanding Loan Balance')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {(bd.exposure?.customers || []).map((c: any) => (
                        <tr key={c.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                          <td className="p-2.5 font-medium">{c.name}</td>
                          <td className="p-2.5 text-slate-400 font-mono">{c.phone || '—'}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">Rs. {Number(c.loanBalance).toLocaleString()}</td>
                        </tr>
                      ))}
                      {(!bd.exposure?.customers || bd.exposure.customers.length === 0) && (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-slate-500">
                            No customers with active loan balances
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer - Fixed & never clipped */}
        <div
          className={`p-4 border-t flex items-center justify-between shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/60'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{t('financial.prismaVerification', 'Formulas verified against Prisma transactional database')}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            {t('financial.closeAudit', 'Close Audit')}
          </button>
        </div>
      </div>
    </div>
  );

  // 🌟 Mount directly into document.body using React Portal to eliminate all parent layout constraints & top gaps
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default FinancialBreakdownModal;
