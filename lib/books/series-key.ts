/**
 * Normalizes a series name for matching: lowercase, drops a leading "The ",
 * collapses internal whitespace, trims. Returns null for null / empty /
 * whitespace-only input.
 *
 * Used to match books in the same series despite author inconsistency
 * ("The Stormlight Archive" vs "stormlight archive" vs "  STORMLIGHT
 * ARCHIVE "). Display name in UI is always the raw `seriesName` — this
 * helper is for matching only.
 */
export function normalizeSeriesKey(name: string | null): string | null {
  if (!name) return null
  const normalized = name
    .toLowerCase()
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized.length === 0 ? null : normalized
}
