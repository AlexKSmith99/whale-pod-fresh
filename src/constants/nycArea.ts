// Curated NYC-metro allowlist for the onboarding location gate.
// Whale Pod currently only admits members in NYC or the immediately
// surrounding metro. `isNycArea` is the single source of truth for that gate;
// `NYC_SUGGESTIONS` powers the type-ahead on the "Your Details" onboarding step.
import { NEIGHBORHOODS } from './neighborhoods';

// Cities / boroughs / nearby towns we accept. Lowercase, matched as substrings
// so "Brooklyn", "Brooklyn, NY", and "Williamsburg, Brooklyn" all pass.
const NYC_KEYWORDS: string[] = [
  // NYC itself
  'new york city', 'new york, ny', 'new york', 'nyc',
  'manhattan', 'brooklyn', 'queens', 'the bronx', 'bronx', 'staten island',
  // Nearby New Jersey (across the Hudson)
  'jersey city', 'hoboken', 'weehawken', 'union city', 'west new york',
  'north bergen', 'guttenberg', 'edgewater', 'fort lee', 'newark', 'harrison',
  // Nearby New York (Westchester / western Long Island)
  'yonkers', 'mount vernon', 'new rochelle', 'long island city',
];

// Fold in recognized NYC neighborhoods (Astoria, Williamsburg, Harlem, …).
const NYC_NEIGHBORHOODS: string[] = (NEIGHBORHOODS['New York'] ?? []).map(n => n.toLowerCase());

const NYC_MATCHERS: string[] = Array.from(new Set([...NYC_KEYWORDS, ...NYC_NEIGHBORHOODS]));

/**
 * Returns true if the free-text location is in NYC or the nearby metro.
 * Empty / whitespace input is treated as "not yet valid" (false).
 */
export function isNycArea(input: string): boolean {
  const s = input.trim().toLowerCase();
  if (s.length === 0) return false;
  return NYC_MATCHERS.some(m => s.includes(m));
}

// Nicely-cased type-ahead suggestions shown under the location field.
export const NYC_SUGGESTIONS: string[] = [
  'Manhattan, NY',
  'Brooklyn, NY',
  'Queens, NY',
  'Bronx, NY',
  'Staten Island, NY',
  'Long Island City, NY',
  'Astoria, NY',
  'Williamsburg, Brooklyn',
  'Harlem, NY',
  'Park Slope, Brooklyn',
  'Jersey City, NJ',
  'Hoboken, NJ',
  'Weehawken, NJ',
  'Yonkers, NY',
  'New Rochelle, NY',
];

/** Suggestions matching the current input (prefix or contained), capped at 5. */
export function nycSuggestions(input: string): string[] {
  const s = input.trim().toLowerCase();
  if (s.length < 1) return [];
  return NYC_SUGGESTIONS.filter(c => c.toLowerCase().includes(s)).slice(0, 5);
}
