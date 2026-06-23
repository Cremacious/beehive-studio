import { db } from '@/db'
import { books } from '@/db/schema'
import { bookLikes, follows } from '@/db/schema/social'
import { eq } from 'drizzle-orm'
import { topGenres, type SignalRow } from './taste-vector'
import type { GenreSlug } from './genres'
import { unstable_cache } from 'next/cache'

/**
 * Issue #18: shared taste-vector helper for the 4 new entity For You actions
 * (sparks, hives, lists, clubs). Computes the viewer's top N inferred genres
 * via the same weighted-signal formula Books For You uses inline:
 *   bookLikes×3 + followed-author own-books×2 + viewer's own-books×1.
 *
 * Cached per viewer for 1h via `unstable_cache`. Mirrors the cache TTL used by
 * `getPlatformTopGenres` (see `lib/discover/platform-top-genres.ts`).
 *
 * NOTE: Books For You's `tier2Candidates` inlines this same query rather than
 * calling this helper — that path is load-bearing and is NOT modified by
 * issue #18 to avoid regression. This helper is for the 4 NEW actions only.
 */
async function _viewerTopGenres(
  viewerId: string,
  limit = 3,
): Promise<GenreSlug[]> {
  const [likedGenres, followedAuthorGenres, ownBookGenres] = await Promise.all([
    db
      .select({ genre: books.genre })
      .from(bookLikes)
      .innerJoin(books, eq(books.id, bookLikes.bookId))
      .where(eq(bookLikes.userId, viewerId)),
    db
      .select({ genre: books.genre })
      .from(follows)
      .innerJoin(books, eq(books.userId, follows.followeeId))
      .where(eq(follows.followerId, viewerId)),
    db
      .select({ genre: books.genre })
      .from(books)
      .where(eq(books.userId, viewerId)),
  ])
  const rows: SignalRow[] = [
    ...likedGenres.map((r) => ({ genre: r.genre, weight: 3 })),
    ...followedAuthorGenres.map((r) => ({ genre: r.genre, weight: 2 })),
    ...ownBookGenres.map((r) => ({ genre: r.genre, weight: 1 })),
  ]
  return topGenres(rows, limit)
}

export const getViewerTopGenres = (
  viewerId: string,
  limit = 3,
): Promise<GenreSlug[]> =>
  unstable_cache(
    () => _viewerTopGenres(viewerId, limit),
    ['viewer-top-genres', viewerId, String(limit)],
    { revalidate: 60 * 60 },
  )()
