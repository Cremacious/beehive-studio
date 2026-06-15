import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import { books } from '@/db/schema'
import { follows } from '@/db/schema/social'
import { eq, isNotNull } from 'drizzle-orm'
import { topGenres } from './taste-vector'
import { type GenreSlug } from './genres'

/**
 * Computes the platform's most-followed 3 genres, where each follow is
 * attributed to one of the followee's published books' genre.
 * Cached 1h via unstable_cache.
 *
 * Used by Tier 3 of the For You algorithm as the fallback genre set
 * when the viewer has no personal signal.
 *
 * TODO(plan): tighten to most-recent published book per followee if
 * genre attribution drifts. Current implementation attributes every
 * follow to every book the followee has written; multi-book authors
 * mostly write in one genre so this is acceptable for v1.
 */
export const getPlatformTopGenres = unstable_cache(
  async (): Promise<GenreSlug[]> => {
    const rows = await db
      .select({ genre: books.genre })
      .from(follows)
      .innerJoin(books, eq(books.userId, follows.followeeId))
      .where(isNotNull(books.genre))
    return topGenres(
      rows.map((r) => ({ genre: r.genre, weight: 1 })),
      3,
    )
  },
  ['platform-top-genres'],
  { revalidate: 3600, tags: ['platform-top-genres'] },
)
