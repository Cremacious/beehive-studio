import { db } from '@/db'
import { books } from '@/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { normalizeSeriesKey } from './series-key'
import { canReadBook } from './can-read'

export type SeriesNeighbor = {
  id: string
  title: string
  seriesNumber: number | null
}

export type SeriesNeighbors = {
  previous: SeriesNeighbor | null
  next: SeriesNeighbor | null
  total: number
}

type CurrentBookShape = {
  id: string
  userId: string
  seriesName: string | null
  seriesNumber: number | null
}

/**
 * Returns previous + next books in the same series, plus a reader-visible
 * total count.
 *
 * - Matches by same `userId` AND same `normalizeSeriesKey(seriesName)`.
 * - "Previous" = largest seriesNumber strictly less than current.
 *   "Next" = smallest seriesNumber strictly greater than current. Skips gaps.
 * - Filters every candidate through `canReadBook(bookId, viewerUserId)`.
 *   Books the viewer cannot read are silently omitted.
 * - Current book with `seriesNumber === null` has no position — returns null
 *   neighbors. `total` still counts reader-visible books in the series.
 * - Current book with no seriesName returns `{ previous: null, next: null,
 *   total: 0 }` without hitting the DB query path.
 */
export async function getSeriesNeighbors({
  currentBook,
  viewerUserId,
}: {
  currentBook: CurrentBookShape
  viewerUserId: string | null
}): Promise<SeriesNeighbors> {
  const key = normalizeSeriesKey(currentBook.seriesName)
  if (!key) return { previous: null, next: null, total: 0 }

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      userId: books.userId,
      seriesName: books.seriesName,
      seriesNumber: books.seriesNumber,
    })
    .from(books)
    .where(and(eq(books.userId, currentBook.userId), isNotNull(books.seriesName)))

  // Filter to same normalized key (in JS — normalization can't be done in SQL).
  const sameSeries = rows.filter(r => normalizeSeriesKey(r.seriesName) === key)

  // Filter to reader-visible only.
  const visible: typeof sameSeries = []
  for (const r of sameSeries) {
    const access = await canReadBook(r.id, viewerUserId)
    if (access.ok) visible.push(r)
  }

  const total = visible.length

  // If current book has no number, no positional neighbors possible.
  if (currentBook.seriesNumber === null) {
    return { previous: null, next: null, total }
  }

  // Books with numbers + not the current book.
  const numbered = visible
    .filter(r => r.seriesNumber !== null && r.id !== currentBook.id)
    .sort((a, b) => (a.seriesNumber as number) - (b.seriesNumber as number))

  let previous: SeriesNeighbor | null = null
  let next: SeriesNeighbor | null = null
  for (const r of numbered) {
    const n = r.seriesNumber as number
    if (n < currentBook.seriesNumber) previous = { id: r.id, title: r.title, seriesNumber: n }
    if (n > currentBook.seriesNumber && next === null) {
      next = { id: r.id, title: r.title, seriesNumber: n }
    }
  }

  return { previous, next, total }
}
