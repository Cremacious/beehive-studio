import { cache } from 'react'
import { db } from '@/db'
import { hives } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Reverse-lookup: returns the hive linked to a book, or null.
 * Memoized per-request via React cache() so the binder footer, the
 * book-card "has hive" indicator, and createHiveAction's uniqueness
 * check don't all re-query.
 */
export const getBookHive = cache(
  async (bookId: string): Promise<{ hiveId: string } | null> => {
    const row = await db.query.hives.findFirst({
      where: eq(hives.bookId, bookId),
      columns: { id: true },
    })
    return row ? { hiveId: row.id } : null
  }
)
