import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogIn, ArrowLeft } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Top-Level Production React Error Boundary
 * 
 * Prevents black screens / blank views from crashing the root render tree.
 * Catches unhandled dynamic module failures, syntax regressions, and network aborts,
 * presenting a polished recovery interface with single-click reload and session reset.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Uncaught application error caught:', error, errorInfo);
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem('app_chunk_reload_timestamp');
    } catch {}
    window.location.reload();
  };

  handleGoToLogin = () => {
    try {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
    } catch {}
    window.location.href = '/login';
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred';
      const isChunkError =
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('504');

      // Theme detection for fallback view matching application state
      const isDark = typeof document !== 'undefined'
        ? document.documentElement.classList.contains('dark') || (localStorage.getItem('theme') !== 'light' && !document.documentElement.classList.contains('light'))
        : true;

      return (
        <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden select-none font-sans ${
          isDark ? 'bg-[#0a0f1a] text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}>
          {/* Ambient lighting backdrop */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className={`absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[100px] ${
              isDark ? 'bg-rose-500/10' : 'bg-rose-500/15'
            }`} />
            <div className={`absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-[100px] ${
              isDark ? 'bg-orange-500/10' : 'bg-orange-500/15'
            }`} />
          </div>

          <div className={`relative w-full max-w-lg rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-colors ${
            isDark
              ? 'bg-slate-900/90 border border-slate-800/80 text-white shadow-black/60'
              : 'bg-white border border-slate-200 text-slate-900 shadow-slate-300/60'
          }`}>
            {/* Header Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg ${
              isDark
                ? 'bg-gradient-to-tr from-rose-500/20 to-orange-500/20 border border-rose-500/30 shadow-rose-500/10 text-rose-400'
                : 'bg-gradient-to-tr from-rose-100 to-orange-100 border border-rose-200 shadow-rose-100 text-rose-600'
            }`}>
              <AlertTriangle className="w-7 h-7" />
            </div>

            {/* Error Titles */}
            <h1 className={`text-xl sm:text-2xl font-bold text-center mb-2 tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {isChunkError ? 'Application Update Detected' : 'Application Encountered an Error'}
            </h1>
            <p className={`text-xs sm:text-sm text-center mb-6 leading-relaxed ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {isChunkError
                ? 'A new version or component bundle was updated on the server. Please reload the application to sync your session.'
                : 'A critical module error was caught by the recovery boundary. Your session data is intact.'}
            </p>

            {/* Error Message Details Card */}
            <div className={`p-3.5 rounded-xl border text-left font-mono text-xs mb-6 overflow-x-auto max-h-32 ${
              isDark
                ? 'bg-slate-950/70 border-slate-800 text-rose-300/90'
                : 'bg-rose-50/70 border-rose-200 text-rose-700'
            }`}>
              <span className={`block text-[10px] uppercase font-sans mb-1 font-semibold ${
                isDark ? 'text-slate-500' : 'text-rose-900/60'
              }`}>
                Technical Exception:
              </span>
              {errorMessage}
            </div>

            {/* Recovery Action Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className={`py-2 px-3 border font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700/80 border-slate-700/60 text-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleGoToLogin}
                  className={`py-2 px-3 border font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700/80 border-slate-700/60 text-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Login Screen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
