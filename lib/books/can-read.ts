import { db } from '@/db'
import { books } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type BookAccess =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'PRIVATE' | 'FRIENDS_ONLY' }

export async function canReadBook(
  bookId: string,
  viewerUserId: string | null,
): Promise<BookAccess> {
  const [book] = await db
    .select({ id: books.id, userId: books.userId, visibility: books.visibility })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1)

  if (!book) return { ok: false, reason: 'NOT_FOUND' }
  if (viewerUserId && book.userId === viewerUserId) return { ok: true }
  if (book.visibility === 'PUBLIC') return { ok: true }
  if (book.visibility === 'FRIENDS') return { ok: false, reason: 'FRIENDS_ONLY' }
  return { ok: false, reason: 'PRIVATE' }
}
