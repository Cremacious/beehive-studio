/**
 * Shared (non-'use server') helpers for Reading List discover/hub actions.
 *
 * Lives outside `'use server'` modules so projection helpers can be reused
 * across reading-lists.actions, discover-lists.actions, and the new
 * reading-lists-hub.actions without violating Next.js's rule that every
 * export from a server-action module must be an async function.
 *
 * Mirrors the precedent of `lib/actions/discover-shared.ts`.
 */

import { db } from '@/db'
import { sql } from 'drizzle-orm'

const COVER_PREVIEW_CAP = 3

export type CoverPreview = { bookId: string | null; coverUrl: string | null }

/**
 * Top 3 covers per list via ROW_NUMBER() window over `reading_list_books`
 * ordered by `position` (column name `order`). Reads denorm `cover_url`
 * directly — no books JOIN per the established Lists pattern.
 *
 * Bounded query cost regardless of list size.
 */
export async function loadCoverPreviewsMap(
  listIds: string[],
): Promise<Map<string, CoverPreview[]>> {
  if (listIds.length === 0) return new Map()
  const result = await db.execute<{
    list_id: string
    book_id: string | null
    cover_url: string | null
  }>(sql`
    SELECT list_id, book_id, cover_url FROM (
      SELECT
        rlb.list_id,
        rlb.book_id,
        rlb.cover_url,
        ROW_NUMBER() OVER (PARTITION BY rlb.list_id ORDER BY rlb."order") AS rn
      FROM reading_list_books rlb
      WHERE rlb.list_id = ANY(ARRAY[${sql.join(
        listIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::text[])
    ) sub WHERE rn <= ${COVER_PREVIEW_CAP}
  `)
  const rows =
    (result as unknown as { rows?: unknown[] }).rows ??
    (result as unknown as unknown[])
  const typed = rows as Array<{
    list_id: string
    book_id: string | null
    cover_url: string | null
  }>
  const map = new Map<string, CoverPreview[]>()
  for (const r of typed) {
    const list = map.get(r.list_id) ?? []
    list.push({ bookId: r.book_id, coverUrl: r.cover_url })
    map.set(r.list_id, list)
  }
  return map
}
