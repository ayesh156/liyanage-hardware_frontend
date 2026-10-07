import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { BrandFullLoader } from '../components/ui/BrandFullLoader';

/**
 * @file LoadingContext.tsx
 * @description Executive Page Loading & Transition Coordinator.
 * 
 * Performance & Transition Mechanics:
 * 1. Fast Hydration Curve (Page Refresh & Login):
 *    - Rapid fill from 0% to 60% within 200ms.
 *    - Climbs to ~90% between 200ms and 500ms.
 * 2. Guaranteed 100% Completion (finishLoading):
 *    - Animates remaining progress smoothly straight to 100% within 150ms.
 *    - Holds at 100% for a 120ms beat so the user visually sees emerald 100%.
 *    - Executes a 200ms CSS opacity fade-out before unmounting (isLoading = false).
 * 3. Fail-Safe Fallback:
 *    - Automatically ramps to 100% and finishes after a maximum of 1.2 seconds if a network request hangs.
 * 4. Section Navigation:
 *    - Internal route switches use a sleek top horizontal gradient progress bar without locking the screen.
 *    - Reserves full-screen splash for initial boot, hard refreshes, and post-login entry.
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
 * RouteLoadingWatcher monitors React Router location changes.
 * For internal route navigation, it triggers a sleek top horizontal gradient progress bar
 * without locking the screen with the fullscreen splash modal.
 */
const RouteLoadingWatcher: React.FC<{ triggerTopNavProgress: () => void }> = ({ triggerTopNavProgress }) => {
  const location = useLocation();
  const { isLoading } = useLoading();
  const prevPathRef = useRef<string>(location.pathname);
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevPathRef.current = location.pathname;
      return;
    }

    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      // Do NOT trigger full-screen splash modal on internal route link clicks.
      // Trigger top horizontal gradient progress bar instead if full-screen splash is inactive.
      if (!isLoading) {
        triggerTopNavProgress();
      }
    }
  }, [location.pathname, isLoading, triggerTopNavProgress]);

  return null;
};

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true); // Active on initial app mount
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [loadingText, setLoadingText] = useState<string>('Initializing workspace...');

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
      let nextProgress = 0;

      if (elapsed <= 200) {
        // Fast Ease-In: 0% -> 60% within 200ms
        nextProgress = (elapsed / 200) * 60;
      } else if (elapsed <= 500) {
        // Steady Climb: 60% -> 90% between 200ms and 500ms
        nextProgress = 60 + ((elapsed - 200) / 300) * 30;
      } else {
        // Organic Micro-increment stall approaching 95%
        const stallTime = elapsed - 500;
        nextProgress = 90 + 5 * (1 - Math.exp(-stallTime / 800));
      }

      if ((elapsed > 800 || nextProgress >= 85) && !customMessageRef.current) {
        setLoadingText('Preparing workspace & inventory...');
      }

      const bounded = Math.min(95, Math.max(0, nextProgress));
      currentProgressRef.current = bounded;
      setProgress(bounded);

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

          // 4. Set isLoading: false after the 200ms fade duration ends
          fadeTimeoutRef.current = setTimeout(() => {
            setIsLoading(false);
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
    if (isFinishingRef.current) return;
    executeCompletionTween();
  }, [executeCompletionTween]);

  const startLoading = useCallback((customMessage?: string) => {
    clearAllTimers();
    isFinishingRef.current = false;
    startTimeRef.current = Date.now();
    currentProgressRef.current = 0;
    customMessageRef.current = customMessage || null;

    setLoadingText(customMessage || 'Initializing workspace...');
    setProgress(0);
    setIsFadingOut(false);
    setIsLoading(true);

    runPhysicsLoop();

    // Fail-safe fallback timeout: smoothly ramp to 100% after max 1.2s on standard refreshes
    failSafeTimeoutRef.current = setTimeout(() => {
      if (!isFinishingRef.current) {
        finishLoading();
      }
    }, 1200);
  }, [clearAllTimers, runPhysicsLoop, finishLoading]);

  // Fast top bar loader sweep for internal route changes
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

  // Initial page refresh trigger: fill quickly 0->60% in 200ms, then finish loading
  useEffect(() => {
    startLoading('Initializing workspace...');

    const initialTimer = setTimeout(() => {
      finishLoading();
    }, 300);

    return () => {
      clearTimeout(initialTimer);
      clearAllTimers();
    };
  }, [startLoading, finishLoading, clearAllTimers]);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        isFadingOut,
        progress,
        loadingText,
        startLoading,
        finishLoading,
      }}
    >
      <RouteLoadingWatcher triggerTopNavProgress={triggerTopNavProgress} />
      {children}
      {/* Sleek Top Horizontal Gradient Progress Bar for internal tab switches */}
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
      {/* Fullscreen Branded Splash Loader for initial boot, refresh & login entry */}
      {(isLoading || isFadingOut) && <BrandFullLoader />}
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

