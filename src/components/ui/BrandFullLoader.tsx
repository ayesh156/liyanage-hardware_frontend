import React, { useState, useEffect, useRef } from 'react';
import { useLoading, calculateTrickleProgress } from '../../contexts/LoadingContext';
import { useTheme } from '../../contexts/ThemeContext';

interface BrandFullLoaderProps {
  message?: string;
  isLoaded?: boolean;
  onComplete?: () => void;
  minDurationMs?: number;
}

export const BrandFullLoader: React.FC<BrandFullLoaderProps> = ({
  message,
  isLoaded,
  onComplete,
  minDurationMs = 400,
}) => {
  // Theme-aware detection with graceful fallback
  let isDark = true;
  try {
    const themeContext = useTheme();
    isDark = themeContext.theme === 'dark';
  } catch {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    isDark = stored !== 'light';
  }

  // Safe context extraction (handles when rendered outside LoadingProvider or standalone)
  let context: ReturnType<typeof useLoading> | null = null;
  try {
    context = useLoading();
  } catch {
    context = null;
  }

  const [standaloneProgress, setStandaloneProgress] = useState<number>(0);
  const [standaloneFadingOut, setStandaloneFadingOut] = useState<boolean>(false);
  const [standaloneHidden, setStandaloneHidden] = useState<boolean>(false);

  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const isSnappingRef = useRef<boolean>(false);

  // Standalone mode activates if context is unavailable OR if explicit props are passed
  const isStandalone = !context || isLoaded !== undefined;

  useEffect(() => {
    if (!isStandalone) return;

    startTimeRef.current = Date.now();
    isSnappingRef.current = false;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;

      if (isLoaded && elapsed >= minDurationMs && !isSnappingRef.current) {
        isSnappingRef.current = true;
        setStandaloneProgress(100);

        setTimeout(() => {
          setStandaloneFadingOut(true);
          setTimeout(() => {
            setStandaloneHidden(true);
            if (onComplete) onComplete();
          }, 200);
        }, 120);
        return;
      }

      if (!isSnappingRef.current) {
        const current = calculateTrickleProgress(elapsed);
        setStandaloneProgress(current);
        animRef.current = requestAnimationFrame(tick);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [isStandalone, isLoaded, minDurationMs, onComplete]);

  // Determine active render properties based on context vs standalone mode
  const activeProgress = isStandalone ? standaloneProgress : context.progress;
  const activeFadingOut = isStandalone ? standaloneFadingOut : context.isFadingOut;
  const activeMessage = message || (isStandalone ? 'Initializing workspace...' : context.loadingText);

  if (isStandalone && standaloneHidden) return null;

  const displayPercent = Math.min(100, Math.max(0, Math.round(activeProgress)));
  const isComplete = displayPercent >= 100;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center pointer-events-auto transition-opacity duration-200 ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      } ${
        activeFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <style>{`
        @keyframes shimmerSheen {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer-sheen {
          animation: shimmerSheen 1.5s infinite linear;
        }
      `}</style>

      {/* Ambient Radial Glow Halos */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none animate-pulse ${
        isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/15'
      }`} />
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-2xl pointer-events-none animate-pulse ${
          isDark ? 'bg-amber-500/15' : 'bg-amber-500/20'
        }`}
        style={{ animationDelay: '500ms' }}
      />

      <div className="relative flex flex-col items-center gap-6 max-w-sm w-full px-6 text-center z-10">
        {/* Centered Branding: Logo with Ambient Pulse & Halo Glow */}
        <div className="relative group">
          <div className={`absolute -inset-2 rounded-3xl blur-xl animate-pulse ${
            isDark
              ? 'bg-gradient-to-r from-emerald-500/30 via-amber-500/40 to-emerald-500/30 opacity-80'
              : 'bg-gradient-to-r from-orange-500/20 via-amber-400/30 to-emerald-500/20 opacity-70'
          }`} />

          <img
            src="/logo.jpg"
            alt="Liyanage Hardware"
            className={`relative w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-2xl border transition-all ${
              isDark
                ? 'border-slate-700/60 shadow-2xl drop-shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                : 'border-slate-200 shadow-xl drop-shadow-[0_10px_25px_rgba(245,158,11,0.15)] bg-white'
            }`}
          />
        </div>

        {/* Glowing Segmented/Fluid Progress Track */}
        <div className="flex flex-col items-center gap-3 w-full mt-2">
          {/* Progress Track */}
          <div className={`w-72 sm:w-80 h-2 rounded-full overflow-hidden border relative shadow-inner ${
            isDark
              ? 'bg-slate-800/80 border-slate-700/50'
              : 'bg-slate-200 border-slate-300'
          }`}>
            {/* Inner Fill with Shimmer Sheen */}
            <div
              className={`h-full transition-all duration-150 ease-out rounded-full relative overflow-hidden ${
                isComplete
                  ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 shadow-[0_0_16px_rgba(16,185,129,0.8)]'
                  : 'bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
              }`}
              style={{ width: `${displayPercent}%` }}
            >
              {/* Continuous Shimmer Sheen */}
              <div className="absolute inset-0 w-full h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)] animate-shimmer-sheen" />
            </div>
          </div>

          {/* Subtitle & Tabular Counter */}
          <div className="flex flex-col items-center gap-1">
            <span className={`text-xs font-mono font-bold tracking-wider tabular-nums ${
              isDark ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              {displayPercent}%
            </span>
            <p className={`text-xs sm:text-sm font-medium tracking-wide ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {isComplete ? 'Workspace Ready!' : activeMessage}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandFullLoader;

