import { type GenreSlug, isValidGenre } from './genres'

export type SignalRow = { genre: string | null; weight: number }

/**
 * Builds a taste vector from weighted signal rows and returns the top N genres.
 * - Null/invalid genres are silently dropped.
 * - Deterministic tiebreak: alphabetical by genre slug.
 * - Always returns up to N genres; fewer if there's insufficient signal.
 */
export function topGenres(rows: SignalRow[], n: number): GenreSlug[] {
  const counts: Partial<Record<GenreSlug, number>> = {}
  for (const r of rows) {
    if (!r.genre || !isValidGenre(r.genre)) continue
    const g = r.genre as GenreSlug
    counts[g] = (counts[g] ?? 0) + r.weight
  }
  return (Object.keys(counts) as GenreSlug[])
    .sort((a, b) => {
      const da = counts[a] ?? 0
      const db = counts[b] ?? 0
      if (db !== da) return db - da
      return a.localeCompare(b)
    })
    .slice(0, n)
}
