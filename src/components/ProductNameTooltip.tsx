import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

/**
 * Mapping of common Unicode vulgar fractions to standard ASCII fractions.
 */
const VULGAR_FRACTION_MAP: Record<string, string> = {
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

/**
 * Regular expression to extract hardware dimensions and fractions from product names.
 *
 * Pattern breakdown:
 * 1. Mixed fractions: e.g. "1 1/2", "1-1/2", "2 3/4" with optional inch marks (", ″, '', in, inch)
 *    Matches integers followed by spaces or hyphens and a fraction `\b(?:\d+[\s-]+)?\d+\s*\/\s*\d+`
 * 2. Standalone fractions: e.g. "1/2", "3/4", "5/8" with optional inch marks
 * 3. Numbers with explicit inch / dimension units: e.g. '1"', '2″', '1.5 in', '1 inch'
 * 4. Standalone numbers commonly representing hardware diameters/sizes/gauges: e.g. "1", "2"
 */
const DIMENSION_REGEX =
  /\b(?:\d+[\s-]+)?\d+\s*\/\s*\d+(?:["″]|''|\binch(?:es)?\b|\bin\b)?|\b\d+(?:\.\d+)?(?:["″]|''|\binch(?:es)?\b|\bin\b)|\b\d+(?:\.\d+)?\b/gi;

/**
 * Normalizes a matched dimension string into a canonical representation.
 * - Strips inch marks, quotes, and unit words ("1 1/2\"" -> "1 1/2")
 * - Normalizes hyphens and multiple spaces in mixed fractions ("1-1/2" -> "1 1/2")
 * - Normalizes whitespace around slashes ("3 / 4" -> "3/4")
 *
 * @param token - Raw matched dimension string
 * @returns Clean normalized dimension token
 */
export const normalizeDimension = (token: string): string => {
  return token
    .trim()
    .replace(/["″]|''|\b(?:inch(?:es)?|in)\b/gi, '')
    .replace(/[\s-]+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
};

/**
 * Extracts normalized hardware dimensions and fractions from a product name.
 * Handles both English strings and Sinhala strings with ASCII or Unicode fractions.
 *
 * @param text - Product name string (English or Sinhala)
 * @returns Array of unique normalized dimension tokens found in the name
 */
export const extractHardwareDimensions = (text?: string | null): string[] => {
  if (!text || typeof text !== 'string') return [];

  // Normalize Unicode fractions (e.g., ½ -> 1/2)
  const normalizedText = text.replace(
    /[½¼¾⅓⅔⅛⅜⅝⅞]/g,
    (char) => VULGAR_FRACTION_MAP[char] || char
  );

  const matches = normalizedText.match(DIMENSION_REGEX);
  if (!matches) return [];

  const results: string[] = [];
  for (const match of matches) {
    const normalized = normalizeDimension(match);
    if (normalized && !results.includes(normalized)) {
      results.push(normalized);
    }
  }
  return results;
};

/**
 * Detects whether there is a contradictory dimension between the primary English
 * product name and the secondary Sinhala product name.
 *
 * Safeguard Logic:
 * - If either name is missing or lacks dimensions, returns false (no contradiction detected).
 * - If primary name has fractional dimension(s) (e.g., "3/4") and Sinhala has a contradictory
 *   fraction (e.g., "1/2"), returns true to signal a legacy data-entry error.
 * - If primary name contains a fractional dimension and Sinhala introduces any conflicting dimension
 *   that does not exist in primary name, returns true.
 * - If both contain dimensions and their dimension sets conflict (e.g., 1" vs 2"), returns true.
 *
 * @param primaryName - Primary English product name
 * @param sinhalaName - Fallback/localized Sinhala product name
 * @returns True if a strict dimension mismatch is detected, false otherwise
 */
export const hasDimensionMismatch = (
  primaryName?: string | null,
  sinhalaName?: string | null
): boolean => {
  if (!primaryName || !sinhalaName) return false;

  const primaryDims = extractHardwareDimensions(primaryName);
  const sinhalaDims = extractHardwareDimensions(sinhalaName);

  if (primaryDims.length === 0 || sinhalaDims.length === 0) {
    return false;
  }

  const primaryFractions = primaryDims.filter((d) => d.includes('/'));
  const sinhalaFractions = sinhalaDims.filter((d) => d.includes('/'));

  // 1. Strict fractional mismatch:
  // If primary has a fraction (e.g., "3/4") and Sinhala also has a fraction (e.g., "1/2")
  // and they contradict each other
  if (primaryFractions.length > 0 && sinhalaFractions.length > 0) {
    const hasContradictoryFraction =
      sinhalaFractions.some((sf) => !primaryFractions.includes(sf)) ||
      primaryFractions.some((pf) => !sinhalaFractions.includes(pf));
    if (hasContradictoryFraction) {
      return true;
    }
  }

  // 2. Fractional vs Whole dimension mismatch:
  // If primary has a fractional dimension (e.g., "3/4"), but Sinhala has any conflicting dimension
  if (primaryFractions.length > 0) {
    const hasConflictingDim = sinhalaDims.some((sd) => !primaryDims.includes(sd));
    if (hasConflictingDim) {
      return true;
    }
  }

  // 3. Whole number dimension contradiction:
  // e.g. "1\" Ball Valve" vs "2\" Ball Valve"
  const hasContradiction =
    sinhalaDims.some((sd) => !primaryDims.includes(sd)) &&
    primaryDims.some((pd) => !sinhalaDims.includes(pd));
  if (hasContradiction) {
    return true;
  }

  return false;
};

interface ProductNameTooltipProps {
  /** English product name shown in the table/search row */
  children: React.ReactNode;
  /** English product name used as the primary tooltip display and fallback */
  name?: string;
  /** Sinhala product name — shown in tooltip when valid and language/dual mode active */
  nameSinhala?: string;
  /** Alias for nameSinhala (e.g. item.nameSi) */
  nameSi?: string;
  /** Force specific language display (default: auto dual display when both valid) */
  language?: 'si' | 'en';
  /** Optional inline max-width override. If omitted, responsive Tailwind classes control the width. */
  maxWidth?: number;
  /** Side offset for the tooltip */
  sideOffset?: number;
}

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
  const isSinhala = currentLang === 'si' || currentLang === 'sinhala';

  const primaryName = (name || '').trim();
  const rawSinhala = (nameSi || nameSinhala || '').trim();

  // Safeguard: Detect dimension mismatch between primary and Sinhala names
  const isMismatch = hasDimensionMismatch(primaryName, rawSinhala);

  // If a mismatch is detected, ignore the Sinhala name completely to prevent cashier confusion
  const validSinhalaName = isMismatch ? '' : rawSinhala;

  // Check if both names exist, are valid, and are translated differently
  const hasBothDistinctNames =
    Boolean(primaryName) &&
    Boolean(validSinhalaName) &&
    primaryName.toLowerCase() !== validSinhalaName.toLowerCase();

  // Formatting Logic:
  // - If language prop is explicitly 'en', render primary English name
  // - If language prop is explicitly 'si' and valid Sinhala exists, render Sinhala name
  // - If both names exist, are valid, and translated differently:
  //   Display clearly labeled as [EN]: <name> and [SI]: <nameSinhala> inside tooltip box
  // - Otherwise, safely fallback to displaying ONLY the primary name
  const showDual = !language && hasBothDistinctNames;
  const singleDisplayName =
    language === 'en'
      ? primaryName
      : language === 'si' && validSinhalaName
      ? validSinhalaName
      : primaryName || validSinhalaName || '—';

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-full min-w-0 cursor-pointer">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={sideOffset}
        className="rounded-md border px-2.5 py-1.5 text-xs sm:text-sm font-medium leading-snug shadow-lg z-50 animate-in fade-in-0 zoom-in-95 max-w-[280px] sm:max-w-[340px] whitespace-normal break-words"
        style={maxWidth ? { maxWidth } : undefined}
      >
        {showDual ? (
          <div className="space-y-1 text-left">
            <div className="flex items-start gap-1.5">
              <span className="font-semibold text-muted-foreground shrink-0 select-none">
                [EN]:
              </span>
              <span className="break-words">{primaryName}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-semibold text-muted-foreground shrink-0 select-none">
                [SI]:
              </span>
              <span className="break-words">{validSinhalaName}</span>
            </div>
          </div>
        ) : (
          <p className="leading-snug">{singleDisplayName}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export default ProductNameTooltip;