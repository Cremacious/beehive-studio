import { books } from '@/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'

/**
 * Builds a `WHERE` fragment matching the user's non-shadow books.
 * Pair with any `select().from(books).where(scopedBooksForUser(userId))`.
 *
 * H2 introduced `STANDALONE_HIVE_SHADOW` books — invisible carriers that back
 * standalone hives. Every /studio surface filters them OUT via this helper.
 * The only places that should NOT use it are the hive resolution paths
 * (where the shadow is the load-bearing row).
 */
export function scopedBooksForUser(userId: string) {
  return and(eq(books.userId, userId), ne(books.status, 'STANDALONE_HIVE_SHADOW'))
}

/** Same as `scopedBooksForUser` but as a raw SQL fragment, for compose-into-CTE cases. */
export const scopedBooksForUserSql = (userId: string) =>
  sql`${books.userId} = ${userId} AND ${books.status} != 'STANDALONE_HIVE_SHADOW'`
