import { db } from '@/db'
import { books } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/** Verifies a book belongs to the authenticated user. Throws if not found or unauthorized. */
export async function assertBookOwner(bookId: string, userId: string): Promise<void> {
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
    columns: { id: true },
  })
  if (!book) throw new Error('Book not found or access denied')
}
