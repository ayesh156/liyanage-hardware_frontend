import { ComponentType, lazy, LazyExoticComponent } from 'react';

/**
 * Resilient lazy import wrapper that catches dynamic import and chunk-loading errors.
 * 
 * In modern Vite applications, when dependencies are dynamically re-bundled
 * (causing 504 Outdated Optimize Dep) or when a new deployment invalidates cached chunks,
 * standard React.lazy() crashes into an unhandled Promise rejection.
 * 
 * lazyWithRetry:
 * 1. Attempts sequential retries with exponential backoff.
 * 2. If chunk fetch failure persists, performs a single-time cache-busting page reload
 *    guarded by sessionStorage to avoid infinite reload loops.
 * 3. Falls through to the React ErrorBoundary if recovery is impossible.
 * 
 * @param factory Function returning a dynamic import promise, e.g. () => import('./Page')
 * @param retriesLeft Number of retry attempts before triggering cache-busting reload (default: 2)
 * @param interval Base delay in ms between retries (default: 800ms)
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retriesLeft = 2,
  interval = 800
): LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error: any) => {
            const errorMsg = error?.message || String(error);
            const isChunkLoadFailed =
              errorMsg.includes('Failed to fetch dynamically imported module') ||
              errorMsg.includes('Loading chunk') ||
              errorMsg.includes('504') ||
              errorMsg.includes('Outdated Optimize Dep') ||
              error?.name === 'ChunkLoadError';

            console.warn(
              `[lazyWithRetry] Dynamic import failed (remaining retries: ${remaining}):`,
              errorMsg
            );

            if (remaining > 0) {
              setTimeout(() => {
                attempt(remaining - 1);
              }, interval * (3 - remaining));
            } else if (isChunkLoadFailed && typeof window !== 'undefined') {
              // Guard with a 15-second timestamp to prevent infinite reload loops
              const RELOAD_KEY = 'app_chunk_reload_timestamp';
              const lastReload = sessionStorage.getItem(RELOAD_KEY);
              const now = Date.now();

              if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
                sessionStorage.setItem(RELOAD_KEY, String(now));
                console.info('[lazyWithRetry] Triggering clean cache-busting reload for updated chunks...');
                window.location.reload();
              } else {
                reject(error);
              }
            } else {
              reject(error);
            }
          });
      };

      attempt(retriesLeft);
    })
  );
}
