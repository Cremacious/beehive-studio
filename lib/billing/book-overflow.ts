import { db } from '@/db'
import { books } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { getUserPremiumStatus, FREE_BOOK_LIMIT } from '@/lib/premium'
import { scopedBooksForUser } from '@/lib/books/scoped'

/**
 * Returns true when a non-premium user has more than FREE_BOOK_LIMIT books
 * AND the given book is one of the overflow books.
 *
 * Overflow is determined by createdAt ASC — the user's OLDEST FREE_BOOK_LIMIT
 * books remain active; subsequent books overflow. Choice rationale: stable
 * across edits (vs. updatedAt which would shift the overflow set on every
 * keystroke in a different book).
 *
 * Premium users always get false.
 */
export async function isBookOverflow(userId: string, bookId: string): Promise<boolean> {
  const isPremium = await getUserPremiumStatus(userId)
  if (isPremium) return false

  const userBooks = await db
    .select({ id: books.id })
    .from(books)
    .where(scopedBooksForUser(userId))
    .orderBy(asc(books.createdAt))

  const index = userBooks.findIndex(b => b.id === bookId)
  if (index === -1) return false

  return index >= FREE_BOOK_LIMIT
}
