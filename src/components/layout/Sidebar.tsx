import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { SidebarTooltip } from '../SidebarTooltip';
import { 
  Package, FileText, Users, Settings, 
  ChevronLeft, ChevronRight, HelpCircle,
  TrendingUp, FolderTree, Truck, Zap, Layers
} from 'lucide-react';
import { useIsMobile } from '../../hooks/use-mobile';

export interface NavItemConfig {
  path: string;
  icon: React.ElementType;
  label: string;
  badge: string | null;
}

/**
 * Top-level Sidebar Navigation Component.
 * 
 * Separates Suppliers directory from Goods Received Notes (GRN) into two distinct routes:
 * 1. `/suppliers`: Supplier profiles, contact info, and starting balances.
 * 2. `/grn`: Goods Received Notes, stock intake bills, and payment settlement ledger.
 */
export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebar();

  const navItems: NavItemConfig[] = [
    { path: '/invoices/quick-invoice', icon: Zap, label: 'quickCheckout.title', badge: null },
    { path: '/invoices', icon: FileText, label: 'nav.invoices', badge: '12' },
    { path: '/products', icon: Package, label: 'nav.products', badge: null },
    { path: '/product-category', icon: FolderTree, label: 'nav.productCategory', badge: null },
    { path: '/customers', icon: Users, label: 'nav.customers', badge: '3' },
    { path: '/suppliers', icon: Truck, label: 'nav.suppliers', badge: null },
    { path: '/grn', icon: Layers, label: 'nav.grn', badge: null },
    { path: '/financial-reports', icon: TrendingUp, label: 'nav.financialReports', badge: null },
  ];

  const bottomNavItems = [
    { path: '/settings', icon: Settings, label: 'nav.settings' },
    { path: '/help', icon: HelpCircle, label: 'nav.helpCenter' },
  ];

  const isActive = (path: string) => location.pathname === path;
  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';

  return (
    <aside 
      className={`fixed left-0 top-0 z-50 h-screen ${sidebarWidth} transition-all duration-300 ease-in-out ${
        theme === 'dark' 
          ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-800/50' 
          : 'bg-gradient-to-b from-white via-white to-slate-50 border-r border-slate-200 shadow-xl'
      }`}
    >
      <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'px-4'} h-16 border-b ${theme === 'dark' ? 'border-slate-800/50' : 'border-slate-200'}`}>
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
              <img src="/logo.jpg" alt="Liyanage Hardware" className="w-full h-full object-cover" />
            </div>
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className={`text-base font-bold whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Liyanage<span className="text-amber-500"> Hardware</span>
              </span>
              <span className={`text-[9px] -mt-0.5 tracking-wider uppercase whitespace-nowrap ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('sidebar.adminPanel')}
              </span>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex flex-col h-[calc(100%-4rem)] px-2 py-3 overflow-y-auto">
        <div className="flex-1 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center ${sidebarCollapsed ? 'justify-center w-full' : 'gap-3 px-3'} h-10 rounded-xl font-medium transition-all duration-200 ${
                  active
                    ? theme === 'dark' 
                      ? 'bg-gradient-to-r from-orange-500/20 to-rose-500/10 text-orange-400 shadow-lg shadow-orange-500/10' 
                      : 'bg-gradient-to-r from-orange-500/10 to-rose-500/5 text-orange-600 shadow-lg shadow-orange-500/10'
                    : theme === 'dark' 
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-orange-500 to-rose-500 rounded-r-full" />
                )}
                {!sidebarCollapsed && (
                  <Icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${active ? 'text-orange-500' : ''}`} />
                )}
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-xs">{t(item.label)}</span>
                    {item.badge && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                        theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                      }`}>{item.badge}</span>
                    )}
                  </>
                )}
                {sidebarCollapsed && (
                  <SidebarTooltip label={t(item.label)} badge={item.badge}>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-orange-500' : ''}`} />
                  </SidebarTooltip>
                )}
              </Link>
            );
          })}
        </div>

        <div className="pt-3 space-y-0.5 border-t border-slate-800/30">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center ${sidebarCollapsed ? 'justify-center w-full' : 'gap-3 px-3'} h-10 rounded-xl font-medium transition-all duration-200 ${
                  active
                    ? theme === 'dark' 
                      ? 'bg-gradient-to-r from-orange-500/20 to-rose-500/10 text-orange-400 shadow-lg shadow-orange-500/10' 
                      : 'bg-gradient-to-r from-orange-500/10 to-rose-500/5 text-orange-600 shadow-lg shadow-orange-500/10'
                    : theme === 'dark' 
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-orange-500 to-rose-500 rounded-r-full" />}
                {!sidebarCollapsed && (
                  <Icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${active ? 'text-orange-500' : ''}`} />
                )}
                {!sidebarCollapsed && <span className="text-xs">{t(item.label)}</span>}
                {sidebarCollapsed && (
                  <SidebarTooltip label={t(item.label)}>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-orange-500' : ''}`} />
                  </SidebarTooltip>
                )}
              </Link>
            );
          })}

          {!isMobile && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`group relative flex items-center ${sidebarCollapsed ? 'justify-center w-full' : 'gap-3 px-3'} h-10 rounded-xl font-medium transition-all duration-200 ${
                theme === 'dark' 
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5 transition-transform group-hover:scale-110" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5 transition-transform group-hover:scale-110" />
                  <span className="text-xs">{t('sidebar.collapse')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
