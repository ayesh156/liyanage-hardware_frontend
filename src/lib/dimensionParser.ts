/**
 * @file dimensionParser.ts
 * @description Natural Measurement & Fractional Dimension Parser for Hardware POS & Inventory.
 * 
 * Accurately parses fractional strings and mixed hardware dimensions:
 * - Simple fractions: "1/2" -> 0.5, "3/4" -> 0.75, "3/8" -> 0.375, "5/16" -> 0.3125
 * - Mixed fractions: "1 1/2" -> 1.5, "1 1/4" -> 1.25, "2 1/2" -> 2.5
 * - Common shorthand without spaces: "11/2" -> 1.5, "11/4" -> 1.25, "21/2" -> 2.5, "31/2" -> 3.5
 * - Metric dimensions: "12mm" -> 12, "25mm" -> 25, "32mm" -> 32
 * - Decimal numbers: "1.5", "2.25", "20" -> numeric values
 * 
 * Mathematical ascending ordering strictly guarantees:
 * 1/2" (0.5) -> 3/4" (0.75) -> 1" (1.0) -> 1 1/4" (1.25) -> 1 1/2" (1.5) -> 2" (2.0) -> 3" (3.0) -> 4" (4.0) -> 6" (6.0)
 * rather than naive alphabetical ASCII ordering where "1" mistakenly precedes "1/2".
 */

export interface ParsedDimension {
  /** Primary numeric value of first dimension (e.g. 0.5 for 1/2") */
  numericValue: number;
  /** Multi-tier dimension values for compound sizes (e.g. [0.5, 4] for 1/2" X 4") */
  dimensions: number[];
  /** Exact raw matched substring */
  rawMatched: string;
  /** Flag indicating whether any valid dimension was extracted */
  hasDimension: boolean;
}

/**
 * Parses a fractional or measurement string into its exact numeric floating-point value.
 * Strips quote and unit symbols (e.g. ", in, inch, mm) before evaluating fraction patterns
 * so that values like "1/2\"" accurately evaluate to 0.5 instead of falling back to integer 1.
 * 
 * @param str - The raw string to parse (e.g. "1/2", "1/2\"", "3/4", "1 1/2", "11/2", "25mm")
 * @returns Parsed floating-point numeric value or NaN if invalid
 */
export function parseFractionToNumber(str: string): number {
  if (!str) return NaN;
  const clean = str.trim().replace(/["'”″]|in\b|inch\b|inches\b|mm\b|cm\b/gi, '').trim();
  if (!clean) return NaN;

  // Pattern 1: Mixed fraction with space or hyphen (e.g., "1 1/2", "1-1/2", "2 3/4")
  const mixedMatch = clean.match(/^(\d+)\s*[- ]\s*(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den !== 0) {
      return whole + num / den;
    }
  }

  // Pattern 2: Shorthand mixed fraction without spaces (e.g., "11/2" -> 1 1/2 = 1.5, "21/2" -> 2 1/2 = 2.5, "11/4" -> 1 1/4 = 1.25)
  const shorthandMixedMatch = clean.match(/^(\d)(\d)\/(\d+)$/);
  if (shorthandMixedMatch) {
    const whole = parseInt(shorthandMixedMatch[1], 10);
    const num = parseInt(shorthandMixedMatch[2], 10);
    const den = parseInt(shorthandMixedMatch[3], 10);
    if (den !== 0 && num < den) {
      return whole + num / den;
    }
  }

  // Pattern 3: Simple fraction (e.g., "1/2" -> 0.5, "3/4" -> 0.75, "5/8" -> 0.625)
  const simpleFractionMatch = clean.match(/^(\d+)\/(\d+)$/);
  if (simpleFractionMatch) {
    const num = parseInt(simpleFractionMatch[1], 10);
    const den = parseInt(simpleFractionMatch[2], 10);
    if (den !== 0) {
      return num / den;
    }
  }

  // Pattern 4: Plain decimal or integer (e.g., "1.5", "2", "25", "32")
  const numMatch = clean.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (!isNaN(val)) return val;
  }

  return NaN;
}

/**
 * Extracts a single numeric or fractional dimension from a text fragment.
 * Checks for mixed fractions, shorthand mixed fractions, simple fractions, metric units,
 * inch quotes, and standalone numbers in strict precedence order.
 * 
 * @param text - Single text fragment (e.g. "1/2\"", "1 1/2\"", "25mm", "6")
 * @returns Object with numeric value and raw matched string or null
 */
function extractSingleDimension(text: string): { val: number; raw: string } | null {
  if (!text) return null;
  const clean = text.trim();

  // 1. Mixed fraction: "1 1/2", "1-1/2", "2 1/4"
  const mixedMatch = clean.match(/\b(\d+)\s*[- ]\s*(\d+)\/(\d+)(?:["'”″]|in\b|inch\b|inches\b)?/i);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den !== 0) {
      return { val: whole + num / den, raw: mixedMatch[0] };
    }
  }

  // 2. Shorthand mixed fraction: "11/2", "21/2", "31/2", "11/4"
  const shorthandMatch = clean.match(/\b(\d)(\d)\/(\d+)(?:["'”″]|in\b|inch\b|inches\b)?/i);
  if (shorthandMatch) {
    const whole = parseInt(shorthandMatch[1], 10);
    const num = parseInt(shorthandMatch[2], 10);
    const den = parseInt(shorthandMatch[3], 10);
    if (den !== 0 && num < den) {
      return { val: whole + num / den, raw: shorthandMatch[0] };
    }
  }

  // 3. Simple fraction: "1/2", "3/4", "3/8", "5/16"
  const simpleFractionMatch = clean.match(/\b(\d+)\/(\d+)(?:["'”″]|in\b|inch\b|inches\b)?/i);
  if (simpleFractionMatch) {
    const num = parseInt(simpleFractionMatch[1], 10);
    const den = parseInt(simpleFractionMatch[2], 10);
    if (den !== 0) {
      return { val: num / den, raw: simpleFractionMatch[0] };
    }
  }

  // 4. Metric dimension (e.g. "25mm", "32mm", "110mm")
  const metricMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:mm|cm|meter|m)\b/i);
  if (metricMatch) {
    const val = parseFloat(metricMatch[1]);
    if (!isNaN(val)) {
      return { val, raw: metricMatch[0] };
    }
  }

  // 5. Inch dimension with quote/unit (e.g. 1", 2", 4", 6")
  const inchQuoteMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:["'”″]|in\b|inch\b|inches\b)/i);
  if (inchQuoteMatch) {
    const val = parseFloat(inchQuoteMatch[1]);
    if (!isNaN(val)) {
      return { val, raw: inchQuoteMatch[0] };
    }
  }

  // 6. Standalone number
  const numMatch = clean.match(/\b(\d+(?:\.\d+)?)\b/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (!isNaN(val)) {
      return { val, raw: numMatch[0] };
    }
  }

  return null;
}

/**
 * Extracts primary and multi-tier dimensions from a hardware product name, search key, or size label.
 * Supports compound multi-dimensional hardware specs (e.g. "1/2\" X 4\"", "1/2 X 6", "1 1/2\" X 10\"").
 * 
 * @param text - Product title, name, or size description
 * @returns ParsedDimension object with numericValue, dimensions array, and rawMatched
 */
export function extractDimensionFromText(text: string): ParsedDimension {
  if (!text) {
    return { numericValue: Number.MAX_VALUE, dimensions: [], rawMatched: '', hasDimension: false };
  }

  const clean = text.trim();

  // Check for multi-tier compound dimensions separated by X, x, *, ×, or "by"
  // e.g. "1/2\" X 4\"", "1/2 X 6", "1 1/2\" X 10\"", "25mm X 50mm"
  const multiParts = clean.split(/\s*(?:[xX*×]|\bby\b)\s*/);
  if (multiParts.length > 1) {
    const parsedDims: number[] = [];
    const matchedRaws: string[] = [];

    for (const part of multiParts) {
      const dim = extractSingleDimension(part);
      if (dim) {
        parsedDims.push(dim.val);
        matchedRaws.push(dim.raw);
      } else {
        break;
      }
    }

    if (parsedDims.length >= 2) {
      return {
        numericValue: parsedDims[0],
        dimensions: parsedDims,
        rawMatched: matchedRaws.join(' X '),
        hasDimension: true,
      };
    }
  }

  // Single dimension extraction
  const single = extractSingleDimension(clean);
  if (single) {
    return {
      numericValue: single.val,
      dimensions: [single.val],
      rawMatched: single.raw,
      hasDimension: true,
    };
  }

  return { numericValue: Number.MAX_VALUE, dimensions: [], rawMatched: '', hasDimension: false };
}

/**
 * Comparator function to sort hardware products naturally by dimension size first (multi-tier),
 * then by alphabetical name as secondary criteria.
 * 
 * Mathematical ascending ordering strictly yields:
 * 1/2" (0.5) < 3/4" (0.75) < 1" (1.0) < 1 1/4" (1.25) < 1 1/2" (1.5) < 2" (2.0) < 3" (3.0) < 4" (4.0) < 6" (6.0)
 * 
 * @param a - First product item
 * @param b - Second product item
 * @param nameGetter - Function to extract the display name or string to compare
 * @returns Negative (a < b), zero (a === b), or positive (a > b) sort index
 */
export function naturalDimensionComparator<T>(
  a: T,
  b: T,
  nameGetter: (item: T) => string
): number {
  const nameA = nameGetter(a) || '';
  const nameB = nameGetter(b) || '';

  const dimA = extractDimensionFromText(nameA);
  const dimB = extractDimensionFromText(nameB);

  // If both have dimensions, compare dimensions array level by level
  if (dimA.hasDimension && dimB.hasDimension) {
    const len = Math.max(dimA.dimensions.length, dimB.dimensions.length);
    for (let i = 0; i < len; i++) {
      const valA = dimA.dimensions[i];
      const valB = dimB.dimensions[i];
      if (valA !== undefined && valB !== undefined) {
        if (Math.abs(valA - valB) > 0.0001) {
          return valA - valB;
        }
      } else if (valA !== undefined) {
        // e.g. [0.5, 4] vs [0.5] -> single dimension comes first
        return 1;
      } else if (valB !== undefined) {
        return -1;
      }
    }
  }

  // If only one has dimension, prioritize items with dimensions
  if (dimA.hasDimension && !dimB.hasDimension) return -1;
  if (!dimA.hasDimension && dimB.hasDimension) return 1;

  // Secondary sort: alphabetical locale compare with numeric collation
  return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
}
