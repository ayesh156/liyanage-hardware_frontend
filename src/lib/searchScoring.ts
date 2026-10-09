/**
 * @file searchScoring.ts
 * @description Relevance-Based Search Scoring Engine for Hardware POS.
 * 
 * Ranks search results using weighted relevance scoring:
 * 1. Tier 1 (1000 pts): Exact match or starts-with on product name / dimension
 *    (e.g., searching "1/2" puts "1/2 වතුර බට" or "1/2 Socket" at the very top).
 * 2. Tier 2 (700 pts): Word-boundary matches
 *    (e.g., searching "1/2" matches "කට්ටුව 1/2" or "Brass Valve 1/2").
 * 3. Tier 3 (500 pts): Dimension-aware matching
 *    (e.g., searching "1.5" matches "1 1/2" or "11/2").
 * 4. Tier 4 (200 pts): Substring contains matches at the bottom
 *    (e.g., searching "1/2" matches "31/2 x 10" or "Item-1/200").
 * 
 * Provides instantaneous response times with zero UI lag.
 */

import { extractDimensionFromText, parseFractionToNumber } from './dimensionParser';

export interface ScoredResult<T> {
  item: T;
  score: number;
}

export interface SearchCandidate {
  name?: string | null;
  nameAlt?: string | null;
  searchKey?: string | null;
  barcode?: string | null;
  size?: string | null;
  no?: string | number | null;
  price?: number | string | null;
  category?: string | null;
}

/**
 * Calculates the relevance score for a given product candidate against a search query.
 * Higher scores represent closer and more immediate matches.
 * 
 * @param query - Raw search query string typed by user
 * @param candidate - Searchable fields of the product (name, altName, searchKey, barcode, size, no)
 * @returns Numeric relevance score (0 = no match, >0 = matches)
 */
export function calculateRelevanceScore(
  query: string,
  candidate: SearchCandidate
): number {
  if (!query) return 0;

  const rawQ = query.trim();
  if (!rawQ) return 0;

  const q = rawQ.toLowerCase();
  const qStripped = q.replace(/\s+/g, '');
  const parsedQueryDim = parseFractionToNumber(rawQ);

  let maxScore = 0;

  // ── Priority 0: Exact Barcode / Exact Product No Match ──
  if (candidate.barcode && candidate.barcode.trim() === rawQ) {
    return 2000;
  }
  if (candidate.no && String(candidate.no).trim() === rawQ) {
    return 1900;
  }

  const checkField = (fieldVal?: string | number | null, isPrimaryName = false): number => {
    if (fieldVal === undefined || fieldVal === null) return 0;
    const rawField = String(fieldVal).trim();
    if (!rawField) return 0;

    const fieldLower = rawField.toLowerCase();
    const fieldStripped = fieldLower.replace(/\s+/g, '');

    // 1. Exact string match (ignoring whitespace)
    if (fieldStripped === qStripped || fieldLower === q) {
      return isPrimaryName ? 1000 : 900;
    }

    // 2. Starts-with match (Prefix match at the very beginning of the name/field)
    // Example: Query "1/2" matching "1/2 වතුර බට" or "1/2 PVC"
    if (fieldLower.startsWith(q) || fieldStripped.startsWith(qStripped)) {
      return isPrimaryName ? 850 : 750;
    }

    // 3. Word-boundary matches (starts-with on any individual word)
    // Example: Query "1/2" matching "වතුර බට 1/2" or "Socket 1/2"
    const words = fieldLower.split(/[\s\-_\/]+/);
    const hasWordBoundary = words.some(w => w.startsWith(q));
    if (hasWordBoundary) {
      return isPrimaryName ? 650 : 550;
    }

    // Also test if a phrase after whitespace begins with query
    const spacePrefixRegex = new RegExp(`(?:^|[\\s(,.-])${escapeRegex(q)}`, 'i');
    if (spacePrefixRegex.test(fieldLower)) {
      return isPrimaryName ? 600 : 500;
    }

    // 4. Dimension / Fraction awareness
    // If the query was a fraction (e.g. "1/2" or "1 1/2"), test against candidate's extracted dimension
    if (!isNaN(parsedQueryDim) && parsedQueryDim > 0) {
      const candDim = extractDimensionFromText(rawField);
      if (candDim.hasDimension && Math.abs(candDim.numericValue - parsedQueryDim) < 0.0001) {
        // Exact dimension match within the product name!
        return isPrimaryName ? 550 : 450;
      }
    }

    // 5. Substring contains match (Lowest priority match)
    // Example: Query "1/2" matching inside "31/2 x 10" or "AB1/2CD"
    if (fieldLower.includes(q) || fieldStripped.includes(qStripped)) {
      return isPrimaryName ? 250 : 200;
    }

    return 0;
  };

  // Evaluate candidate fields
  maxScore = Math.max(maxScore, checkField(candidate.name, true));
  maxScore = Math.max(maxScore, checkField(candidate.nameAlt, true));
  maxScore = Math.max(maxScore, checkField(candidate.size, true));
  maxScore = Math.max(maxScore, checkField(candidate.searchKey, false));
  maxScore = Math.max(maxScore, checkField(candidate.barcode, false));
  maxScore = Math.max(maxScore, checkField(candidate.no, false));

  return maxScore;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a candidate is a Pipe, Fitting, or Plumbing hardware item
 * to prioritize plumbing/fittings over general hardware items.
 */
function isPlumbingItem(cand: SearchCandidate): boolean {
  const cat = (cand.category || '').toLowerCase();
  const text = `${cand.name || ''} ${cand.nameAlt || ''} ${cand.searchKey || ''}`.toLowerCase();

  if (/pipe|fitting|plumb|pvc|bath|sanitary|tube|valve/i.test(cat)) {
    return true;
  }

  const plumbingRegex = /\b(pipe|pipes|fitting|fittings|pvc|socket|bend|elbow|tee|valve|nipple|union|reducer|coupling|bush|end\s*cap|tank\s*connector|barb|tap|faucet|hose|collar|flange|gi|cpvc|upvc)\b|බට|සොකට්|එල්බෝ|ටී|වෑල්ව්|නිපල්|යුනියන්|ටැප්|පීවීසී|බෝල්\s*වෑල්ව්/i;
  return plumbingRegex.test(text);
}

/**
 * Sorts and filters a list of items using relevance weighting.
 * Ties within the same relevance tier are broken naturally:
 * 1. Multi-tier dimension ordering (smallest first: 1/2" X 4" before 1/2" X 5" before 1/2" X 6")
 * 2. Pipes & fittings before general hardware items
 * 3. Lower prices before higher prices when dimensions are identical
 * 4. Shorter name / concise matches
 * 5. Alphabetical ordering
 * 
 * @param items - Array of items to filter and rank
 * @param query - Search query
 * @param candidateExtractor - Function to extract searchable candidate attributes from each item
 * @returns Ranked and filtered array of items
 */
export function rankSearchResults<T>(
  items: T[],
  query: string,
  candidateExtractor: (item: T) => SearchCandidate
): T[] {
  if (!query || !query.trim()) return items;

  const scoredList: ScoredResult<T>[] = [];

  for (const item of items) {
    const candidate = candidateExtractor(item);
    const score = calculateRelevanceScore(query, candidate);
    if (score > 0) {
      scoredList.push({ item, score });
    }
  }

  // Sort descending by score, then break ties naturally with multi-tier hardware logic
  scoredList.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    const candA = candidateExtractor(a.item);
    const candB = candidateExtractor(b.item);
    const nameA = candA.name || candA.nameAlt || '';
    const nameB = candB.name || candB.nameAlt || '';

    // Tie-Breaker 1: Multi-Tier Natural Dimension Sorting (Smallest dimensions come first: 1/2" X 4" before 1/2" X 5" before 1/2" X 6")
    const dimA = extractDimensionFromText(nameA || String(candA.size || ''));
    const dimB = extractDimensionFromText(nameB || String(candB.size || ''));

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
          // Pure single dimension comes before multi-dimensional product (e.g. 1/2 Socket before 1/2 X 4 Nipple)
          return 1;
        } else if (valB !== undefined) {
          return -1;
        }
      }
    } else if (dimA.hasDimension && !dimB.hasDimension) {
      return -1;
    } else if (!dimA.hasDimension && dimB.hasDimension) {
      return 1;
    }

    // Tie-Breaker 2: Pipes/Fittings before general hardware items
    const isPlumbA = isPlumbingItem(candA);
    const isPlumbB = isPlumbingItem(candB);
    if (isPlumbA && !isPlumbB) return -1;
    if (!isPlumbA && isPlumbB) return 1;

    // Tie-Breaker 3: Lower prices before higher prices when dimensions are identical
    const priceA = candA.price !== undefined && candA.price !== null ? Number(candA.price) : NaN;
    const priceB = candB.price !== undefined && candB.price !== null ? Number(candB.price) : NaN;
    if (!isNaN(priceA) && !isNaN(priceB) && Math.abs(priceA - priceB) > 0.001) {
      return priceA - priceB;
    }

    // Tie-Breaker 4: Shorter primary name (more concise match)
    const lenA = nameA.length;
    const lenB = nameB.length;
    if (lenA !== lenB) {
      return lenA - lenB;
    }

    // Tie-Breaker 5: Alphabetical
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });

  return scoredList.map(s => s.item);
}
