'use server'

import { cache } from 'react'
import { db } from '@/db'
import { books, bookLikes } from '@/db/schema'
import { follows } from '@/db/schema/social'
import { eq } from 'drizzle-orm'

/**
 * Returns true if the viewer has any discovery signal: at least one follow,
 * one book like, or one own book. Used by resolveDefaultMode to decide
 * whether to default to For You or Trending.
 *
 * React `cache()` so multiple call sites in the same request dedupe.
 */
export const hasAnyDiscoverySignalAction = cache(
  async (viewerId: string): Promise<boolean> => {
    const [followRow] = await db
      .select({ id: follows.followerId })
      .from(follows)
      .where(eq(follows.followerId, viewerId))
      .limit(1)
    if (followRow) return true

    const [likeRow] = await db
      .select({ userId: bookLikes.userId })
      .from(bookLikes)
      .where(eq(bookLikes.userId, viewerId))
      .limit(1)
    if (likeRow) return true

    const [ownBookRow] = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.userId, viewerId))
      .limit(1)
    return !!ownBookRow
  },
)
