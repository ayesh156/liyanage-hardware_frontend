import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/use-mobile';
import { useLoading } from '../contexts/LoadingContext';
import { useCatalog } from '../contexts/CatalogContext';
import api from '../lib/api';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Download, 
  FileText, ArrowUpRight, ArrowDownRight,
  Filter, ChevronDown, Search, Package, Paintbrush, Wrench, Zap,
  Droplets, ShieldCheck, Users, Truck, Receipt, Megaphone, FileCheck,
  SortAsc, SortDesc, RefreshCw, BarChart2, PieChart as PieIcon, FileSpreadsheet,
  Building2, CreditCard as CardIcon, AlertCircle, X
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { SearchableSelect, SearchableSelectOption } from '../components/ui/searchable-select';
import { DataTable, DataTableColumn } from '../components/ui/data-table';
import { DateRangePicker } from '../components/ui/date-range-picker';
import { FinancialBreakdownModal, BreakdownTab } from '../components/modals/FinancialBreakdownModal';
import { FinancialTransaction } from '../data/mockData';

export type PeriodPreset = 'today' | 'yesterday' | 'this_month' | 'this_year' | 'custom';

const CATEGORY_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', 
  '#14b8a6', '#6366f1', '#ef4444', '#06b6d4', '#f97316'
];

export const FinancialReports: React.FC = () => {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const { startLoading, finishLoading } = useLoading();
  const { categories } = useCatalog();
  const isSinhala = i18n.language === 'si';

  /**
   * Dynamically maps each item's category to its Sinhala localized name.
   * Priority:
   * 1. Direct transaction `categorySi` attribute returned by backend Prisma queries
   * 2. Category master database entity matching via CatalogContext (`nameSinhala` or `nameSi`)
   * 3. i18n translation dictionary key (`financial.categories.<name>`)
   * 4. Original category string fallback
   */
  const getCategoryDisplayName = useCallback((categoryName: string, transactionCategorySi?: string): string => {
    if (!categoryName) return '';
    if (!isSinhala) {
      return categoryName;
    }

    // 1. Explicit Sinhala category from transaction model
    if (transactionCategorySi && transactionCategorySi.trim()) {
      return transactionCategorySi.trim();
    }

    // 2. Dynamic lookup from master Category entities in CatalogContext
    if (categories && categories.length > 0) {
      const trimmedQuery = categoryName.trim().toLowerCase();
      const matched = categories.find(
        (c) =>
          c.name?.trim().toLowerCase() === trimmedQuery ||
          c.id?.trim().toLowerCase() === trimmedQuery
      );
      if (matched) {
        const sinhalaName = (matched.nameSinhala || (matched as any).nameSi)?.trim();
        if (sinhalaName) return sinhalaName;
      }
    }

    // 3. i18n translations dictionary lookup (e.g. 'financial.categories.<category>')
    const translationKey = `financial.categories.${categoryName}`;
    const translated = t(translationKey, { defaultValue: '' });
    if (translated && translated !== translationKey && translated !== categoryName) {
      return translated;
    }

    return categoryName;
  }, [isSinhala, categories, t]);
  
  // Date Preset & Filter State
  const [preset, setPreset] = useState<PeriodPreset>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Live Data & Loading State
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [liveSummary, setLiveSummary] = useState<{
    grossSales?: number;
    totalDiscounts?: number;
    totalRevenue: number;
    cogs: number;
    grossProfit: number;
    grossProfitMargin: number;
    totalExpenses: number;
    operatingExpenses: number;
    grnStockExpenditure: number;
    supplierSettlementOutflows: number;
    netProfit: number;
    profitMargin: number;
    customerOutstanding: number;
    supplierDue: number;
    netCashFlow: number;
  } | null>(null);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [breakdownModalOpen, setBreakdownModalOpen] = useState<boolean>(false);
  const [breakdownModalTab, setBreakdownModalTab] = useState<BreakdownTab>('profit');
  const [loading, setLoading] = useState<boolean>(true);

  // Table & Chart State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(12);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'revenue' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [chartView, setChartView] = useState<'area' | 'bar'>('area');

  /**
   * Fetches aggregated financial summary metrics and transaction stream directly
   * from the database endpoint `GET /api/reports/financial`.
   */
  useEffect(() => {
    let isMounted = true;
    const fetchLiveFinancialReport = async () => {
      startLoading('Loading financial reports & metrics...');
      setLoading(true);
      try {
        const queryParams: Record<string, string | undefined> = {
          period: preset,
        };
        if (preset === 'custom') {
          if (startDate) queryParams.startDate = startDate;
          if (endDate) queryParams.endDate = endDate;
        }

        const res = await api.get<any>('/reports/financial', queryParams);
        if (isMounted) {
          const payload = res?.data || res || {};
          const txList = Array.isArray(payload.transactions)
            ? payload.transactions
            : Array.isArray(res?.transactions)
            ? res.transactions
            : [];
          const summaryObj = payload.summary || res?.summary || null;
          const bdObj = payload.breakdown || res?.breakdown || null;

          setTransactions(txList);
          if (summaryObj) {
            setLiveSummary({
              grossSales: Number(summaryObj.grossSales || summaryObj.totalRevenue || 0),
              totalDiscounts: Number(summaryObj.totalDiscounts || 0),
              totalRevenue: Number(summaryObj.totalRevenue || 0),
              cogs: Number(summaryObj.cogs || 0),
              grossProfit: Number(summaryObj.grossProfit || 0),
              grossProfitMargin: Number(summaryObj.grossProfitMargin || 0),
              totalExpenses: Number(summaryObj.totalExpenses || 0),
              operatingExpenses: Number(summaryObj.operatingExpenses || 0),
              grnStockExpenditure: Number(summaryObj.grnStockExpenditure || 0),
              supplierSettlementOutflows: Number(summaryObj.supplierSettlementOutflows || 0),
              netProfit: Number(summaryObj.netProfit || 0),
              profitMargin: Number(summaryObj.profitMargin || 0),
              customerOutstanding: Number(summaryObj.customerOutstanding || 0),
              supplierDue: Number(summaryObj.supplierDue || 0),
              netCashFlow: Number(summaryObj.netCashFlow || 0),
            });
          }
          if (bdObj) {
            setBreakdownData(bdObj);
          }
        }
      } catch (err) {
        console.error('Error fetching live financial report:', err);
        if (isMounted) {
          setTransactions([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          finishLoading();
        }
      }
    };

    fetchLiveFinancialReport();
    return () => { isMounted = false; };
  }, [preset, startDate, endDate, startLoading, finishLoading]);

  // Filter transactions for table display based on client search & filters
  const filteredTransactions = useMemo(() => {
    const filtered = transactions.filter(t => {
      const matchesSearch = searchQuery === '' || 
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      
      return matchesSearch && matchesType && matchesCategory;
    });

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [transactions, searchQuery, typeFilter, categoryFilter, sortOrder]);

  const hasActiveFilters = searchQuery !== '' || typeFilter !== 'all' || categoryFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setCategoryFilter('all');
  };

  // Compute metrics fallback if live summary is pending
  const summary = useMemo(() => {
    if (liveSummary) {
      return liveSummary;
    }

    const revenue = filteredTransactions
      .filter(t => t.type === 'revenue')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netProfit = revenue - expenses;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    
    return { 
      grossSales: revenue,
      totalDiscounts: 0,
      totalRevenue: revenue, 
      cogs: 0,
      grossProfit: revenue,
      grossProfitMargin: 100,
      totalExpenses: expenses, 
      operatingExpenses: expenses,
      grnStockExpenditure: 0,
      supplierSettlementOutflows: 0,
      netProfit, 
      profitMargin,
      customerOutstanding: 0,
      supplierDue: 0,
      netCashFlow: netProfit,
    };
  }, [filteredTransactions, liveSummary]);

  // Generate chart time series data
  const trendChartData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; expense: number; profit: number }>();
    
    const chron = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    chron.forEach(t => {
      const d = new Date(t.date);
      let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (preset === 'this_year') {
        label = d.toLocaleDateString('en-US', { month: 'short' });
      }

      const existing = map.get(label) || { date: label, revenue: 0, expense: 0, profit: 0 };
      if (t.type === 'revenue') {
        existing.revenue += t.amount;
      } else {
        existing.expense += t.amount;
      }
      existing.profit = existing.revenue - existing.expense;
      map.set(label, existing);
    });

    return Array.from(map.values());
  }, [filteredTransactions, preset]);

  // Generate Category Breakdown chart data
  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach(t => {
      const val = map.get(t.category) || 0;
      map.set(t.category, val + t.amount);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredTransactions]);

  // Unique categories list
  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category));
    return Array.from(cats);
  }, [transactions]);

  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'Paint Sales': <Paintbrush className="w-4 h-4 text-orange-500" />,
      'Cement Sales': <Package className="w-4 h-4 text-slate-500" />,
      'Tools': <Wrench className="w-4 h-4 text-blue-500" />,
      'Electrical': <Zap className="w-4 h-4 text-yellow-500" />,
      'Plumbing': <Droplets className="w-4 h-4 text-cyan-500" />,
      'Hardware': <Wrench className="w-4 h-4 text-purple-500" />,
      'Safety Equipment': <ShieldCheck className="w-4 h-4 text-green-500" />,
      'Inventory Purchase': <Package className="w-4 h-4 text-indigo-500" />,
      'Supplier Settlement': <Building2 className="w-4 h-4 text-rose-500" />,
      'Salaries': <Users className="w-4 h-4 text-pink-500" />,
      'Utilities': <Zap className="w-4 h-4 text-amber-500" />,
      'Transportation': <Truck className="w-4 h-4 text-teal-500" />,
      'Maintenance': <Wrench className="w-4 h-4 text-red-500" />,
      'Marketing': <Megaphone className="w-4 h-4 text-violet-500" />,
      'Insurance': <ShieldCheck className="w-4 h-4 text-emerald-500" />,
      'Professional Fees': <FileCheck className="w-4 h-4 text-sky-500" />,
    };
    return iconMap[category] || <Receipt className="w-4 h-4 text-slate-400" />;
  };

  const categoryOptions: SearchableSelectOption[] = useMemo(() => {
    const categoryCounts = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const options: SearchableSelectOption[] = [
      { value: 'all', label: t('financial.allCategories', 'All Categories'), icon: <Filter className="w-4 h-4 text-slate-400" /> }
    ];

    allCategories.forEach(cat => {
      const firstTx = transactions.find(t => t.category === cat);
      options.push({
        value: cat,
        label: getCategoryDisplayName(cat, firstTx?.categorySi),
        icon: getCategoryIcon(cat),
        count: categoryCounts[cat]
      });
    });

    return options;
  }, [allCategories, transactions, getCategoryDisplayName]);

  const typeOptions: SearchableSelectOption[] = useMemo(() => {
    const revenueCount = transactions.filter(t => t.type === 'revenue').length;
    const expenseCount = transactions.filter(t => t.type === 'expense').length;
    return [
      { value: 'all', label: t('financial.allTypes', 'All Types'), icon: <Filter className="w-4 h-4 text-slate-400" />, count: transactions.length },
      { value: 'revenue', label: t('financial.revenueType', 'Revenue'), icon: <TrendingUp className="w-4 h-4 text-emerald-500" />, count: revenueCount },
      { value: 'expense', label: t('financial.expenseType', 'Expense'), icon: <TrendingDown className="w-4 h-4 text-red-500" />, count: expenseCount },
    ];
  }, [transactions, t]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, categoryFilter, preset, startDate, endDate]);

  // CSV Export functionality
  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Payment Method', 'Amount (LKR)'];
    const rows = filteredTransactions.map(t => [
      new Date(t.date).toISOString().split('T')[0],
      t.type.toUpperCase(),
      `"${t.category.replace(/"/g, '""')}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      t.paymentMethod || 'N/A',
      t.amount
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_report_${preset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF / Print Export
  const handleExportPDF = () => {
    const reportTitle = `Financial Report - ${preset.toUpperCase()}`;

    const transactionRows = filteredTransactions.map((t, index) => `
      <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="cell-index">${index + 1}</td>
        <td class="cell-date">${new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td class="cell-type">
          <span class="type-badge ${t.type === 'revenue' ? 'revenue-badge' : 'expense-badge'}">
            ${t.type === 'revenue' ? '↑ Revenue' : '↓ Expense'}
          </span>
        </td>
        <td class="cell-category">${isSinhala ? getCategoryDisplayName(t.category, t.categorySi) : t.category}</td>
        <td class="cell-description">${t.description}</td>
        <td class="cell-payment">${t.paymentMethod ? t.paymentMethod.replace('_', ' ').toUpperCase() : 'N/A'}</td>
        <td class="cell-amount ${t.type === 'revenue' ? 'amount-revenue' : 'amount-expense'}">
          ${t.type === 'revenue' ? '+' : '-'}Rs. ${t.amount.toLocaleString()}
        </td>
      </tr>
    `).join('');

    const printWindow = window.open('', '', 'width=1200,height=800');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Inter', sans-serif; 
              background: #f8fafc;
              padding: 40px;
              color: #1e293b;
            }
            .container {
              max-width: 1000px;
              margin: 0 auto;
              background: white;
              border-radius: 16px;
              padding: 30px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: 800; color: #0f172a; }
            .report-title { font-size: 20px; font-weight: 700; color: #ea580c; margin-top: 5px; }
            .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
            .metric-card { background: #f1f5f9; padding: 15px; border-radius: 12px; border: 1px solid #cbd5e1; }
            .metric-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .metric-value { font-size: 20px; font-weight: 800; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { background: #f8fafc; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; color: #475569; }
            td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
            .amount-revenue { color: #10b981; font-weight: 700; text-align: right; }
            .amount-expense { color: #ef4444; font-weight: 700; text-align: right; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="company-name">Liyanage Hardware</div>
              <div class="report-title">${reportTitle}</div>
              <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Generated on ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Total Revenue</div>
                <div class="metric-value" style="color: #10b981;">Rs. ${summary.totalRevenue.toLocaleString()}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Total Expenses</div>
                <div class="metric-value" style="color: #ef4444;">Rs. ${summary.totalExpenses.toLocaleString()}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Net Profit</div>
                <div class="metric-value" style="color: #3b82f6;">Rs. ${summary.netProfit.toLocaleString()}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Profit Margin</div>
                <div class="metric-value" style="color: #8b5cf6;">${summary.profitMargin.toFixed(1)}%</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Payment Method</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${transactionRows}
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const presetLabels: Record<PeriodPreset, { en: string; si: string }> = {
    today: { en: 'Today', si: 'අද' },
    yesterday: { en: 'Yesterday', si: 'ඊයේ' },
    this_month: { en: 'This Month', si: 'මෙම මාසය' },
    this_year: { en: 'This Year', si: 'මෙම වසර' },
    custom: { en: 'Date Range', si: 'දින පරාසය' },
  };

  return (
    <div className={`min-h-screen p-6 ${isMobile ? 'pb-24' : ''} ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {t('financial.title', 'Financial Reports & Analytics')}
            </h1>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('financial.subtitle', 'Live database aggregated revenue, expenses, and credit exposure')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCSV}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium border transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 shadow-sm'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              {t('financial.exportCsv', 'Export CSV')}
            </button>
            <button
              onClick={handleExportPDF}
              className="no-print flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {t('financial.exportPdf', 'Export PDF')}
            </button>
          </div>
        </div>

        {/* Quick Date Range Preset Toolbar with Integrated DateRangePicker */}
        <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="no-print flex flex-wrap items-center gap-2">
            {(['today', 'yesterday', 'this_month', 'this_year'] as PeriodPreset[]).map((p) => {
              const presetKey = p === 'this_month' ? 'thisMonth' : p === 'this_year' ? 'thisYear' : p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPreset(p);
                    setStartDate('');
                    setEndDate('');
                  }}
                  className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    preset === p
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20'
                      : theme === 'dark'
                      ? 'bg-slate-700/70 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t(`financial.${presetKey}`, presetLabels[p].si)}</span>
                </button>
              );
            })}

            {/* 'දින පරාසය' (Date Range) Single Calendar Popover anchored directly below trigger button */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e }) => {
                setStartDate(s);
                setEndDate(e);
                setPreset('custom');
              }}
              onClear={() => {
                setStartDate('');
                setEndDate('');
                setPreset('this_month');
              }}
              isDark={theme === 'dark'}
              maxDate={new Date()}
              align="auto"
              customTrigger={({ onClick, onClear }) => (
                <button
                  type="button"
                  onClick={() => {
                    setPreset('custom');
                    onClick();
                  }}
                  className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    preset === 'custom'
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20'
                      : theme === 'dark'
                      ? 'bg-slate-700/70 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {preset === 'custom' && startDate && endDate
                      ? `${startDate} ~ ${endDate}`
                      : t('financial.customRange', 'දින පරාසය')}
                  </span>
                  {preset === 'custom' && startDate && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onClear(e);
                        setPreset('this_month');
                      }}
                      className="p-0.5 rounded hover:bg-white/20 text-white ml-0.5"
                      title={t('calendar.clear', 'Clear')}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              )}
            />
          </div>
        </div>

        {/* Drill-down KPI Cards — All Clickable with Breakdown Audit Modal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Revenue */}
          <div 
            onClick={() => {
              setBreakdownModalTab('revenue');
              setBreakdownModalOpen(true);
            }}
            className={`p-6 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] hover:border-emerald-500/60 ${
              theme === 'dark' 
                ? 'bg-slate-800/80 border-emerald-500/30 shadow-lg shadow-emerald-950/20 hover:bg-slate-800' 
                : 'bg-white border-emerald-200 shadow-sm hover:shadow-md'
            }`}
            title={t('financial.clickItemizedProof', 'Click to view itemized revenue proof')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
              }`}>
                <TrendingUp className="w-6 h-6 text-emerald-500" />
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {t('financial.invoicesStreamProof', 'Invoices Stream • Proof ↗')}
              </span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('financial.revenue', 'Total Revenue')}
            </p>
            <p className={`text-3xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Rs. {summary.totalRevenue.toLocaleString()}
            </p>
            <p className={`text-[10px] mt-2 font-mono ${theme === 'dark' ? 'text-emerald-400/80' : 'text-emerald-700'}`}>
              {t('financial.clickItemizedProof', 'Click to view itemized invoice records')}
            </p>
          </div>

          {/* Card 2: Total Expenses / GRN Procurement */}
          <div 
            onClick={() => {
              setBreakdownModalTab('expenses');
              setBreakdownModalOpen(true);
            }}
            className={`p-6 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] hover:border-red-500/60 ${
              theme === 'dark' 
                ? 'bg-slate-800/80 border-red-500/30 shadow-lg shadow-red-950/20 hover:bg-slate-800' 
                : 'bg-white border-red-200 shadow-sm hover:shadow-md'
            }`}
            title={t('financial.clickExpensesProof', 'Click to view GRN stock & expense breakdown')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
              }`}>
                <TrendingDown className="w-6 h-6 text-red-500" />
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                theme === 'dark' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {t('financial.grnOverheadProof', 'GRN & Overhead • Proof ↗')}
              </span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('financial.expenses', 'Total Expenses / Outflows')}
            </p>
            <p className={`text-3xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Rs. {summary.totalExpenses.toLocaleString()}
            </p>
            <p className={`text-[10px] mt-2 font-mono ${theme === 'dark' ? 'text-red-400/80' : 'text-red-700'}`}>
              {t('financial.opExPrefix', 'OpEx')}: Rs. {summary.operatingExpenses.toLocaleString()} • {t('financial.grnPrefix', 'GRN')}: Rs. {summary.grnStockExpenditure.toLocaleString()}
            </p>
          </div>

          {/* Card 3: True Net Profit / Loss with Gross Profit & Margin */}
          <div 
            onClick={() => {
              setBreakdownModalTab('profit');
              setBreakdownModalOpen(true);
            }}
            className={`p-6 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] hover:border-blue-500/60 ${
              summary.netProfit >= 0
                ? theme === 'dark' ? 'bg-slate-800/80 border-blue-500/30 shadow-lg shadow-blue-950/20 hover:bg-slate-800' : 'bg-white border-blue-200 shadow-sm hover:shadow-md'
                : theme === 'dark' ? 'bg-slate-800/80 border-orange-500/30 shadow-lg shadow-orange-950/20 hover:bg-slate-800' : 'bg-white border-orange-200 shadow-sm hover:shadow-md'
            }`}
            title={t('financial.clickProfitProof', 'Click to view True Net Profit formula proof')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                summary.netProfit >= 0
                  ? theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                  : theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <DollarSign className={`w-6 h-6 ${summary.netProfit >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border ${
                summary.netProfit >= 0
                  ? theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200'
                  : theme === 'dark' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200'
              }`}>
                {summary.netProfit >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {summary.profitMargin.toFixed(1)}% {t('financial.netMargin', 'Net Margin ↗')}
              </span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('financial.profit', 'True Net Profit')}
            </p>
            <p className={`text-3xl font-extrabold ${
              summary.netProfit >= 0
                ? theme === 'dark' ? 'text-white' : 'text-slate-900'
                : 'text-orange-500'
            }`}>
              {summary.netProfit >= 0 ? '' : '-'}Rs. {Math.abs(summary.netProfit).toLocaleString()}
            </p>
            <p className={`text-[10px] mt-2 font-mono ${theme === 'dark' ? 'text-blue-400/80' : 'text-blue-700'}`}>
              {t('financial.grossProfitLabel', 'Gross Profit:')} Rs. {summary.grossProfit.toLocaleString()} ({summary.grossProfitMargin.toFixed(1)}% {t('financial.grossPrefix', 'Gross')})
            </p>
          </div>

          {/* Card 4: Outstanding Credit Exposure */}
          <div 
            onClick={() => {
              setBreakdownModalTab('exposure');
              setBreakdownModalOpen(true);
            }}
            className={`p-6 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] hover:border-purple-500/60 ${
              theme === 'dark' ? 'bg-slate-800/80 border-purple-500/30 shadow-lg shadow-purple-950/20 hover:bg-slate-800' : 'bg-white border-purple-200 shadow-sm hover:shadow-md'
            }`}
            title={t('financial.clickExposureProof', 'Click to view Customer Loans vs Supplier Dues breakdown')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
                <Building2 className="w-6 h-6 text-purple-500" />
              </div>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                theme === 'dark' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {t('financial.liveExposure', 'Live Exposure ↗')}
              </span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('financial.creditExposure', 'Credit & Debt Exposure')}
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{t('financial.customerLoans', 'Customer Loans')}:</span>
                <span className="font-bold text-emerald-400">Rs. {summary.customerOutstanding.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{t('financial.supplierDues', 'Supplier Dues')}:</span>
                <span className="font-bold text-rose-400">Rs. {summary.supplierDue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visualizations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart (Area / Bar) */}
          <div className={`lg:col-span-2 p-6 rounded-2xl border ${
            theme === 'dark' ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {t('financial.revenueVSExpense', 'Revenue vs Expenses')}
                </h3>
                <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('financial.financialTrajectory', 'Financial trajectory for active timeframe')}
                </p>
              </div>
              {/* Chart type toggle button with accessible high-contrast light and dark styling */}
              <div className={`flex items-center gap-1 p-1 rounded-lg border transition-colors ${
                theme === 'dark' 
                  ? 'border-slate-700/40 bg-slate-800/40' 
                  : 'border-slate-300 bg-slate-100 shadow-inner'
              }`}>
                <button
                  type="button"
                  onClick={() => setChartView('area')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    chartView === 'area'
                      ? 'bg-orange-500 text-white shadow-sm font-semibold'
                      : theme === 'dark'
                      ? 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                  title={t('financial.areaChart', 'Line / Area Chart')}
                >
                  <BarChart2 className="w-4 h-4 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('bar')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    chartView === 'bar'
                      ? 'bg-orange-500 text-white shadow-sm font-semibold'
                      : theme === 'dark'
                      ? 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                  title={t('financial.barChart', 'Bar Chart')}
                >
                  <BarChart2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 p-6 animate-pulse bg-slate-900/40 rounded-2xl border border-slate-800/60">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80" />
                  <div className="h-3 w-40 bg-slate-800/80 rounded-full" />
                </div>
              ) : trendChartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                  <AlertCircle className="w-8 h-8 opacity-40" />
                  <span>{t('financial.noTransactionsPeriod', 'No financial transactions recorded for this period')}</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === 'area' ? (
                    <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="date" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 12 }} />
                      <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                          borderColor: theme === 'dark' ? '#475569' : '#cbd5e1',
                          borderRadius: '12px',
                          color: theme === 'dark' ? '#ffffff' : '#0f172a'
                        }}
                        formatter={(val: number) => [`Rs. ${val.toLocaleString()}`, '']}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" name={t('financial.revenueType', 'Revenue')} stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                      <Area type="monotone" dataKey="expense" name={t('financial.expenseType', 'Expense')} stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="date" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 12 }} />
                      <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                          borderColor: theme === 'dark' ? '#475569' : '#cbd5e1',
                          borderRadius: '12px'
                        }}
                        formatter={(val: number) => [`Rs. ${val.toLocaleString()}`, '']}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name={t('financial.revenueType', 'Revenue')} fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name={t('financial.expenseType', 'Expense')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category Breakdown Donut Chart */}
          <div className={`p-6 rounded-2xl border ${
            theme === 'dark' ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {t('financial.categoryBreakdown', 'Category Breakdown')}
                </h3>
                <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('financial.topCategories', 'Top 8 category volumes')}
                </p>
              </div>
              <PieIcon className="w-5 h-5 text-orange-500" />
            </div>

            <div className="h-64 w-full">
              {categoryChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  {t('financial.noCategories', 'No categories recorded')}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                        borderColor: theme === 'dark' ? '#475569' : '#cbd5e1',
                        borderRadius: '12px'
                      }}
                      formatter={(val: number) => [`Rs. ${val.toLocaleString()}`, 'Value']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700/30">
              {categoryChartData.slice(0, 4).map((entry, index) => {
                const firstTx = transactions.find(t => t.category === entry.name);
                return (
                  <div key={entry.name} className="flex items-center gap-2 text-xs truncate">
                    <span 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} 
                    />
                    <span className={`truncate ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {getCategoryDisplayName(entry.name, firstTx?.categorySi)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className={`p-4 rounded-xl border ${
          theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  placeholder={t('financial.searchTransactions', 'Search transactions...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all ${
                    theme === 'dark' 
                      ? 'bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border ${
                  hasActiveFilters
                    ? 'bg-orange-500 text-white border-orange-500'
                    : theme === 'dark' 
                      ? 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700' 
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                {t('common.filter', 'Filter')}
                {hasActiveFilters && (
                  <span className="w-5 h-5 bg-white/20 rounded-full text-xs flex items-center justify-center">
                    {[typeFilter !== 'all', categoryFilter !== 'all'].filter(Boolean).length}
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t('financial.clearFilters', 'Clear Filters')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className={`p-2 rounded-lg border transition-colors ${
                  theme === 'dark' ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className={`flex flex-wrap gap-4 pt-4 mt-4 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <div className="flex-1 min-w-[180px]">
                <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('financial.transactionType', 'Transaction Type')}
                </label>
                <SearchableSelect
                  options={typeOptions}
                  value={typeFilter}
                  onValueChange={(val) => setTypeFilter(val as 'all' | 'revenue' | 'expense')}
                  placeholder={t('financial.allTypes', 'All Types')}
                  searchPlaceholder={t('financial.searchType', 'Search type...')}
                  emptyMessage={t('financial.noTypeFound', 'No type found.')}
                  theme={theme}
                />
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('financial.category', 'Category')}
                </label>
                <SearchableSelect
                  options={categoryOptions}
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  placeholder={t('financial.allCategories', 'All Categories')}
                  searchPlaceholder={t('financial.searchCategories', 'Search categories...')}
                  emptyMessage={t('financial.noCategoryFound', 'No category found.')}
                  theme={theme}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Data Table */}
        <DataTable
          loading={loading}
          data={filteredTransactions}
          columns={[
            {
              id: 'date',
              header: t('tableHeaders.date', 'Date'),
              cell: (transaction) => (
                <div className="flex items-center gap-2">
                  <Calendar className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                    {new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              ),
            },
            {
              id: 'type',
              header: t('tableHeaders.type', 'Type'),
              cell: (transaction) => (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  transaction.type === 'revenue'
                    ? theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    : theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                }`}>
                  {transaction.type === 'revenue' ? (
                    <><TrendingUp className="w-3 h-3" /> {t('financial.revenueType', 'Revenue')}</>
                  ) : (
                    <><TrendingDown className="w-3 h-3" /> {t('financial.expenseType', 'Expense')}</>
                  )}
                </span>
              ),
            },
            {
              id: 'category',
              header: t('tableHeaders.category', 'Category'),
              cell: (transaction) => {
                // 🌟 Dynamic Sinhala localization mapping for category column
                const displayName = getCategoryDisplayName(transaction.category, transaction.categorySi);
                return (
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(transaction.category)}
                    <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {displayName}
                    </span>
                  </div>
                );
              },
            },
            {
              id: 'description',
              header: t('tableHeaders.description', 'Description'),
              cell: (transaction) => {
                const rawDesc = transaction.description || '';
                // Map "Walk-in Customer" to its Sinhala translation via i18n
                const walkInLabel = t('financial.walkInCustomer', t('quickInvoice.walkInCustomer', 'සාමාන්ය පාරිභෝගිකයා'));
                const displayDesc = rawDesc.includes('Walk-in Customer')
                  ? rawDesc.replace(/Walk-in Customer/g, walkInLabel)
                  : rawDesc;

                return (
                  <span className={`max-w-xs truncate block ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} title={displayDesc}>
                    {displayDesc}
                  </span>
                );
              },
            },
            {
              id: 'amount',
              header: t('tableHeaders.amount', 'Amount'),
              headerClassName: 'text-right',
              className: 'text-right',
              cell: (transaction) => (
                <span className={`font-bold ${
                  transaction.type === 'revenue' ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {transaction.type === 'revenue' ? '+' : '-'}Rs. {transaction.amount.toLocaleString()}
                </span>
              ),
            },
          ] as DataTableColumn<typeof filteredTransactions[0]>[]}
          pageSize={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          title={t('financial.transactionHistory', 'Live Financial Stream')}
          icon={<FileText className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />}
          emptyState={{
            icon: <FileText className="w-12 h-12 opacity-30" />,
            title: t('financial.noTransactions', 'No Transactions Found'),
            description: t('financial.adjustFilters', 'Adjust your preset dates or filters')
          }}
          theme={theme}
          getRowKey={(row) => row.id}
        />

        {/* Breakdown Proof Modal */}
        <FinancialBreakdownModal
          isOpen={breakdownModalOpen}
          onClose={() => setBreakdownModalOpen(false)}
          initialTab={breakdownModalTab}
          data={{ summary, breakdown: breakdownData }}
        />
      </div>
    </div>
  );
};
