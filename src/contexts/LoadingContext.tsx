import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { BrandFullLoader } from '../components/ui/BrandFullLoader';

/**
 * @file LoadingContext.tsx
 * @description Executive Application Loader & Continuous Dynamic Progress Coordinator.
 * 
 * Physics & Interpolation Mechanics:
 * 1. Continuous Physics-Based Trickle Engine (0% -> 99.5%):
 *    - Immediate Ease-In (0ms - 250ms): Fluidly climbs from 0% to ~48% upon request dispatch.
 *    - Logarithmic Dynamic Trickle (250ms+): Asymptotically approaches 99.5% using a dynamic inverse-power curve.
 *    - Zero Stalling Guarantee: Progress is strictly monotonic (P(t+dt) > P(t)), ensuring visible continuous movement at all times under any network latency.
 * 2. Rapid Data Resolution (finishLoading):
 *    - Upon API promise resolution, smoothly accelerates from current percentage straight to 100% (150ms quad ease-out).
 *    - Holds at 100% for a 120ms beat to provide clear visual feedback.
 *    - Executes a 200ms silky opacity fade-out before unmounting.
 * 3. Route Loading Watcher:
 *    - Lightweight top progress sweep for internal route changes without locking screen.
 */

export interface LoadingContextType {
  isLoading: boolean;
  isFadingOut: boolean;
  progress: number;
  loadingText: string;
  startLoading: (customMessage?: string) => void;
  finishLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: React.ReactNode;
}

/**
 * Calculates continuous logarithmic physics trickle progress based on elapsed time.
 * Guaranteed strictly monotonic (P(t+dt) > P(t)) so the progress bar constantly advances
 * smoothly without ever pausing, freezing, or stalling at a fixed number.
 * 
 * @param elapsedMs - Milliseconds elapsed since request dispatch
 * @returns Bounded progress percentage strictly within [0, 99.5)
 */
export const calculateTrickleProgress = (elapsedMs: number): number => {
  if (elapsedMs <= 0) return 0;

  if (elapsedMs <= 250) {
    // Initial rapid burst: 0% -> 48% within first 250ms for instant visual feedback
    const t = elapsedMs / 250;
    return 48 * Math.pow(t, 0.75);
  }

  // Logarithmic continuous trickle from 48% towards 99.5%
  // Strictly monotonic: derivative is strictly positive for all elapsedMs > 250
  const tSub = (elapsedMs - 250) / 1200;
  const trickleFactor = 1 - 1 / (1 + Math.pow(tSub, 0.65));
  const progress = 48 + 51.5 * trickleFactor;

  return Math.min(99.5, progress);
};

/**
 * RouteLoadingWatcher monitors React Router location changes.
 * Top-level route switches (e.g. /invoices -> /products) trigger the branded splash transition.
 * Sub-route / filter changes trigger the sleek top horizontal gradient progress bar.
 */
const RouteLoadingWatcher: React.FC<{
  triggerTopNavProgress: () => void;
  triggerTopLevelRouteTransition: (route: string) => void;
}> = ({ triggerTopNavProgress, triggerTopLevelRouteTransition }) => {
  const location = useLocation();
  const prevPathRef = useRef<string>(location.pathname);
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevPathRef.current = location.pathname;
      return;
    }

    if (prevPathRef.current !== location.pathname) {
      const prevTop = '/' + (prevPathRef.current.split('/')[1] || '');
      const currTop = '/' + (location.pathname.split('/')[1] || '');
      prevPathRef.current = location.pathname;

      if (prevTop !== currTop) {
        // Top-level route switch (e.g., /invoices -> /products)
        triggerTopLevelRouteTransition(currTop);
      } else {
        // In-page or sub-route transition: use non-intrusive top progress bar
        triggerTopNavProgress();
      }
    }
  }, [location.pathname, triggerTopNavProgress, triggerTopLevelRouteTransition]);

  return null;
};

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  // Full-screen branded splash is strictly scoped to initial app load, hard refreshes, and top-level route switches
  const [isFullScreenSplash, setIsFullScreenSplash] = useState<boolean>(true); // Active on initial app mount / hard refresh
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [loadingText, setLoadingText] = useState<string>('Initializing workspace...');

  // Component-level data loading state for localized spinners without screen locking
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  // Top bar progress for internal section routing
  const [isTopLoading, setIsTopLoading] = useState<boolean>(false);
  const [topProgress, setTopProgress] = useState<number>(0);
  const [isTopFading, setIsTopFading] = useState<boolean>(false);

  const animationFrameRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failSafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topNavAnimRef = useRef<number | null>(null);
  const topNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const isFinishingRef = useRef<boolean>(false);
  const currentProgressRef = useRef<number>(0);
  const customMessageRef = useRef<string | null>(null);

  const clearAllTimers = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (holdTimeoutRef.current !== null) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (fadeTimeoutRef.current !== null) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    if (failSafeTimeoutRef.current !== null) {
      clearTimeout(failSafeTimeoutRef.current);
      failSafeTimeoutRef.current = null;
    }
  }, []);

  const runPhysicsLoop = useCallback(() => {
    const tick = () => {
      if (isFinishingRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;
      const nextProgress = calculateTrickleProgress(elapsed);

      if (elapsed > 1000 && !customMessageRef.current) {
        setLoadingText('Preparing workspace & inventory...');
      }

      currentProgressRef.current = nextProgress;
      setProgress(nextProgress);

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const executeCompletionTween = useCallback(() => {
    clearAllTimers();
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;

    const startVal = currentProgressRef.current;
    const duration = 150; // Always animate remaining percent straight to 100% within 150ms
    const tweenStart = Date.now();

    const tweenTick = () => {
      const elapsed = Date.now() - tweenStart;
      const t = Math.min(1, elapsed / duration);
      // Quad ease-out: 1 - (1-t)^2
      const easeOut = 1 - Math.pow(1 - t, 2);
      const currentVal = startVal + (100 - startVal) * easeOut;

      currentProgressRef.current = currentVal;
      setProgress(currentVal);

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(tweenTick);
      } else {
        // 1. Progress = 100
        currentProgressRef.current = 100;
        setProgress(100);

        // 2. Wait 120ms so user sees completed emerald bar & "100%"
        holdTimeoutRef.current = setTimeout(() => {
          // 3. Set fade: true (opacity-0 transition-opacity duration-200)
          setIsFadingOut(true);

          // 4. Set full-screen splash false after the 200ms fade duration ends
          fadeTimeoutRef.current = setTimeout(() => {
            setIsFullScreenSplash(false);
            setIsFadingOut(false);
            setProgress(0);
            isFinishingRef.current = false;
          }, 200);
        }, 120);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tweenTick);
  }, [clearAllTimers]);

  const finishLoading = useCallback(() => {
    setIsDataLoading(false);
    if (isFinishingRef.current) return;
    executeCompletionTween();
  }, [executeCompletionTween]);

  // Fast top bar loader sweep for internal route changes and component fetches
  const triggerTopNavProgress = useCallback(() => {
    if (topNavAnimRef.current !== null) cancelAnimationFrame(topNavAnimRef.current);
    if (topNavTimerRef.current !== null) clearTimeout(topNavTimerRef.current);

    setIsTopLoading(true);
    setIsTopFading(false);
    setTopProgress(0);

    const startTime = Date.now();
    const duration = 180;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const easeOut = 1 - Math.pow(1 - t, 2);
      const val = easeOut * 100;

      setTopProgress(val);

      if (t < 1) {
        topNavAnimRef.current = requestAnimationFrame(tick);
      } else {
        setTopProgress(100);
        topNavTimerRef.current = setTimeout(() => {
          setIsTopFading(true);
          topNavTimerRef.current = setTimeout(() => {
            setIsTopLoading(false);
            setIsTopFading(false);
            setTopProgress(0);
          }, 150);
        }, 80);
      }
    };

    topNavAnimRef.current = requestAnimationFrame(tick);
  }, []);

  // Branded full-screen loader strictly for top-level route switches
  const triggerTopLevelRouteTransition = useCallback((targetRoute: string) => {
    clearAllTimers();
    isFinishingRef.current = false;
    startTimeRef.current = Date.now();
    currentProgressRef.current = 0;
    const cleanRouteName = targetRoute.replace('/', '').toUpperCase() || 'WORKSPACE';
    customMessageRef.current = `Loading ${cleanRouteName}...`;

    setLoadingText(`Loading ${cleanRouteName}...`);
    setProgress(0);
    setIsFadingOut(false);
    setIsFullScreenSplash(true);

    runPhysicsLoop();

    // Smooth snappy transition (250ms)
    setTimeout(() => {
      finishLoading();
    }, 250);
  }, [clearAllTimers, runPhysicsLoop, finishLoading]);

  // startLoading: For standard fetches and mutations, runs non-intrusive top progress bar without blocking screen
  const startLoading = useCallback((customMessage?: string) => {
    setIsDataLoading(true);
    if (customMessage) setLoadingText(customMessage);
    triggerTopNavProgress();
  }, [triggerTopNavProgress]);

  // Initial page refresh trigger: fill quickly 0->60% in 200ms, then finish loading
  useEffect(() => {
    setIsFullScreenSplash(true);
    startTimeRef.current = Date.now();
    currentProgressRef.current = 0;
    setLoadingText('Initializing workspace...');
    runPhysicsLoop();

    const initialTimer = setTimeout(() => {
      finishLoading();
    }, 300);

    return () => {
      clearTimeout(initialTimer);
      clearAllTimers();
    };
  }, [runPhysicsLoop, finishLoading, clearAllTimers]);

  return (
    <LoadingContext.Provider
      value={{
        isLoading: isFullScreenSplash || isDataLoading,
        isFadingOut,
        progress,
        loadingText,
        startLoading,
        finishLoading,
      }}
    >
      <RouteLoadingWatcher
        triggerTopNavProgress={triggerTopNavProgress}
        triggerTopLevelRouteTransition={triggerTopLevelRouteTransition}
      />
      {children}
      {/* Sleek Top Horizontal Gradient Progress Bar for internal tab switches and data operations */}
      {isTopLoading && (
        <div
          className={`fixed top-0 left-0 right-0 z-[999999] h-1 pointer-events-none transition-opacity duration-150 ${
            isTopFading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] transition-all duration-100 ease-out"
            style={{ width: `${topProgress}%` }}
          />
        </div>
      )}
      {/* Fullscreen Branded Splash Loader: Strictly scoped to initial boot, hard refreshes, and top-level route switches */}
      {(isFullScreenSplash || isFadingOut) && <BrandFullLoader />}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

