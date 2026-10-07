import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Package, Tag } from 'lucide-react';
import { Category } from '../../types';
import { resolveImageUrl, extractGoogleDriveFileId } from '../../lib/utils';

export interface CategoryHoverData {
  category: Category;
  productCount?: number;
}

interface HoverPosition {
  x: number;
  y: number;
}

export function useCategoryHoverPreview() {
  const [hoverData, setHoverData] = useState<CategoryHoverData | null>(null);
  const [position, setPosition] = useState<HoverPosition>({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showHoverPreview = useCallback((e: React.MouseEvent, data: CategoryHoverData) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    // Position slightly to the top-right or right of the element
    setPosition({
      x: rect.right + 12,
      y: rect.top - 20,
    });
    setHoverData(data);
    setIsVisible(true);
  }, []);

  const showHoverPreviewAtRect = useCallback((rect: DOMRect, data: CategoryHoverData) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPosition({
      x: rect.right + 12,
      y: rect.top - 20,
    });
    setHoverData(data);
    setIsVisible(true);
  }, []);

  const hideHoverPreview = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setHoverData(null);
    }, 50);
  }, []);

  return {
    hoverData,
    position,
    isVisible,
    showHoverPreview,
    showHoverPreviewAtRect,
    hideHoverPreview,
  };
}

interface CategoryHoverPreviewProps {
  data: CategoryHoverData | null;
  position: HoverPosition;
  isVisible: boolean;
}

/**
 * CategoryHoverPreview
 *
 * Renders a lightweight, high-resolution portal hover preview card for category items.
 *
 * Visual Features:
 * - Unobstructed photo preview with zero overlaid badges for maximum image clarity.
 * - Row 1 (English Title): Full-width header displaying the English category name across the top.
 * - Row 2 (Sinhala Name + Product Count Badge): Tight spacing (`space-y-0.5`) with Sinhala category name on left (`text-xs text-slate-600 dark:text-slate-300 truncate flex-1`),
 *   and product count badge neatly pinned to the far right (`text-[10px] font-medium shrink-0`).
 * - Row 3 (Sort Index / Footer): Sort Index tag aligned to bottom right.
 * - Viewport boundary collision detection (flips horizontally/vertically to stay on-screen).
 */
export const CategoryHoverPreview: React.FC<CategoryHoverPreviewProps> = ({
  data,
  position,
  isVisible,
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset image error when category changes
  React.useEffect(() => {
    setImageError(false);
  }, [data?.category?.id, data?.category?.imageUrl]);

  if (!isVisible || !data || typeof document === 'undefined') return null;

  const { category, productCount } = data;
  const PREVIEW_WIDTH = 260;
  const PREVIEW_HEIGHT = 290;

  // Viewport-safe coordinates calculation
  const padding = 16;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = position.x;
  let top = position.y;

  // If overflowing right, flip to left of element
  if (left + PREVIEW_WIDTH + padding > viewportWidth) {
    left = Math.max(padding, position.x - PREVIEW_WIDTH - 24);
  }

  // If overflowing bottom, shift up
  if (top + PREVIEW_HEIGHT + padding > viewportHeight) {
    top = Math.max(padding, viewportHeight - PREVIEW_HEIGHT - padding);
  }

  // Ensure top is not negative
  if (top < padding) {
    top = padding;
  }

  const hasImage = Boolean(category.imageUrl && !imageError);

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none transition-all duration-150 ease-out animate-in fade-in-0 zoom-in-95"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${PREVIEW_WIDTH}px`,
      }}
    >
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 p-3 shadow-2xl backdrop-blur-md overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/10">
        {/* Unobstructed photo preview or styled fallback */}
        <div className="relative w-full aspect-video max-h-36 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mb-2.5 flex items-center justify-center">
          {hasImage ? (
            <img
              src={resolveImageUrl(category.imageUrl)}
              alt={category.name}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              loading="lazy"
              onError={(e) => {
                // Automatic fallback to alternative Google CDN if thumbnail fails
                const target = e.currentTarget;
                const fileId = extractGoogleDriveFileId(category.imageUrl || target.src);
                if (fileId && !target.dataset.fallbackTried) {
                  target.dataset.fallbackTried = "true";
                  target.src = `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
                } else {
                  setImageError(true);
                }
              }}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-slate-100 dark:bg-slate-900 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Package className="w-8 h-8 text-emerald-600 dark:text-emerald-400 stroke-[1.5] mb-1" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Category Preview
              </span>
            </div>
          )}
        </div>

        {/* Content details & metadata */}
        <div className="space-y-1.5">
          {/* Header block with optimized vertical gap */}
          <div className="space-y-0.5">
            {/* Row 1 (English Title): Full-width header */}
            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate w-full" title={category.name}>
              {category.name}
            </h4>

            {/* Row 2 (Sinhala Name + Product Count Badge) */}
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1" title={category.nameSinhala || undefined}>
                {category.nameSinhala || ''}
              </span>

              {/* Relocated Product Count Badge */}
              {typeof productCount === 'number' && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0 shadow-2xs">
                  <Package className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{productCount} {productCount === 1 ? 'Product' : 'Products'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Optional Category Description */}
          {category.description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800/80">
              {category.description}
            </p>
          )}

          {/* Row 3 (Sort Index / Footer): Sort Index tag aligned to bottom right */}
          {typeof category.sortOrder === 'number' && (
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 font-mono border-t border-slate-100 dark:border-slate-800/60">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" /> Sort Index
              </span>
              <span className="px-1.5 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800">
                #{category.sortOrder}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CategoryHoverPreview;
