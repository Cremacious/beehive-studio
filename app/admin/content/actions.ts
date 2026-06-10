'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  books,
  sparks,
  bookComments,
  hiveBuzzPosts,
  bookClubDiscussions,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin/require-admin'
import { logAdminAction } from '@/lib/admin/log-action'

export type ContentKind = 'book' | 'spark' | 'book_comment' | 'buzz_post' | 'club_discussion'

export async function deleteContentAction(
  kind: ContentKind,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!id) return { ok: false, error: 'Missing id.' }

  switch (kind) {
    case 'book':
      await db.delete(books).where(eq(books.id, id))
      break
    case 'spark':
      await db.delete(sparks).where(eq(sparks.id, id))
      break
    case 'book_comment':
      await db.delete(bookComments).where(eq(bookComments.id, id))
      break
    case 'buzz_post':
      await db.delete(hiveBuzzPosts).where(eq(hiveBuzzPosts.id, id))
      break
    case 'club_discussion':
      await db.delete(bookClubDiscussions).where(eq(bookClubDiscussions.id, id))
      break
    default:
      return { ok: false, error: 'Unknown content kind.' }
  }

  await logAdminAction({
    adminEmail: admin.email,
    action: 'content.delete',
    targetType: kind,
    targetId: id,
  })
  revalidatePath('/admin/content')
  return { ok: true }
}
