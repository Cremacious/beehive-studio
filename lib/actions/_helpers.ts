import { db } from '@/db'
import { books, hives, hiveMembers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/** Verifies a book belongs to the authenticated user. Throws if not found or unauthorized. */
export async function assertBookOwner(bookId: string, userId: string): Promise<void> {
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
    columns: { id: true },
  })
  if (!book) throw new Error('Book not found or access denied')
}

/** Verifies caller is a member of the hive. Returns the member row. */
export async function assertHiveMember(hiveId: string, userId: string) {
  const member = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, userId)),
  })
  if (!member) throw new Error('Not a member of this hive')
  return member
}

/** Verifies caller is the hive owner. */
export async function assertHiveOwner(hiveId: string, userId: string) {
  const hive = await db.query.hives.findFirst({
    where: and(eq(hives.id, hiveId), eq(hives.ownerId, userId)),
    columns: { id: true },
  })
  if (!hive) throw new Error('Hive not found or access denied')
}

/** Verifies caller is owner or has EDITOR role in the hive. */
export async function assertHiveAdmin(hiveId: string, userId: string) {
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { ownerId: true },
  })
  if (!hive) throw new Error('Hive not found')
  if (hive.ownerId === userId) return
  const member = await db.query.hiveMembers.findFirst({
    where: and(
      eq(hiveMembers.hiveId, hiveId),
      eq(hiveMembers.userId, userId),
      eq(hiveMembers.role, 'EDITOR'),
    ),
  })
  if (!member) throw new Error('Admin access required')
}
