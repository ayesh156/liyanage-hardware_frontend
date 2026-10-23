import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

/**
 * Truncate text to a maximum length (default: 40 chars) to prevent bloated tooltips.
 */
export const truncateText = (text?: string | null, maxLength: number = 40): string => {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.substring(0, maxLength)}...` : trimmed;
};

interface ProductNameTooltipProps {
  /** English or localized product name shown in the table/search row */
  children?: React.ReactNode;
  /** English product name used as primary tooltip display and fallback */
  name?: string;
  /** 
   * Sinhala product name.
   * Takes strict precedence over legacy `nameSi` when resolving Sinhala tooltip text.
   */
  nameSinhala?: string;
  /** 
   * Legacy alias for nameSinhala (e.g. item.nameSi).
   * Used only as a fallback when `nameSinhala` is undefined or empty.
   */
  nameSi?: string;
  /** Force English or Sinhala tooltip mode (default: auto-detected from i18n) */
  language?: 'si' | 'en';
  /** Optional inline max-width override. If omitted, responsive Tailwind classes control width. */
  maxWidth?: number;
  /** Side offset for the tooltip */
  sideOffset?: number;
}

/**
 * ProductNameTooltip renders the exact name of a specific product item in a tooltip.
 * 
 * ARCHITECTURAL RULES & SAFEGUARDS:
 * 1. ZERO CATALOG LOOKUPS / CROSS-REFERENCING:
 *    Multiple products legitimately share identical search keys (e.g., "UNU WATHURA BATA"
 *    shared by "1/2 උණු වතුර බටය" and "3/4 උණු වතුර බටය"). Therefore, `searchKey` must NEVER
 *    be used as a unique key for name resolution or dictionary lookups. This component
 *    strictly renders the exact attributes passed for this specific item without any
 *    cross-referencing or `inventoryItems.find()` lookups.
 * 
 * 2. `nameSinhala` TAKES STRICT PRECEDENCE OVER LEGACY `nameSi`:
 *    When a product is edited, `nameSinhala` is updated. If legacy `nameSi` was left stale
 *    in the database or copy-pasted, prioritizing `nameSi` causes the tooltip to show another
 *    product's stale Sinhala name. `nameSinhala` is always checked first; `nameSi` is only
 *    consulted as a fallback for older database records where `nameSinhala` is not yet populated.
 * 
 * 3. STRICT ACTIVE UI LANGUAGE RESPECT:
 *    - Sinhala active (`i18n.language === 'si'`): use `nameSinhala || nameSi || name`.
 *    - English active: use `name` (with fallback to child text if name prop omitted).
 */
const ProductNameTooltip: React.FC<ProductNameTooltipProps> = ({
  children,
  name,
  nameSinhala,
  nameSi,
  language,
  maxWidth,
  sideOffset = 4,
}) => {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language || '').toLowerCase();
  const isSinhala = language ? language === 'si' : (currentLang === 'si' || currentLang === 'sinhala');

  const englishName = (name || '').trim();
  // Prioritize nameSinhala over legacy nameSi so edited/fresh Sinhala names are never masked by stale nameSi
  const sinhalaName = (nameSinhala || nameSi || '').trim();

  // Child text fallback when name prop is omitted but children is a string
  const fallbackChildText = typeof children === 'string' ? children.trim() : '';

  // Language resolution:
  // When Sinhala is active: use nameSinhala || nameSi || name
  // When English is active: use name (fallback to child text, then sinhalaName if English name is empty)
  const rawDisplayName = isSinhala
    ? (sinhalaName || englishName || fallbackChildText)
    : (englishName || fallbackChildText || sinhalaName);

  // Maximum 40-character truncation safeguard
  const displayText = truncateText(rawDisplayName, 40) || '—';

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-full min-w-0 cursor-pointer">
          {children ?? displayText}
        </span>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={sideOffset}
        className="rounded-md border px-2.5 py-1 text-sm font-medium leading-snug shadow-lg z-50 animate-in fade-in-0 zoom-in-95 max-w-[280px] sm:max-w-[340px] whitespace-normal break-words"
        style={maxWidth ? { maxWidth } : undefined}
      >
        <p className={`leading-snug ${isSinhala && sinhalaName ? 'font-sinhala' : ''}`}>
          {displayText}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

export default ProductNameTooltip;