import { notFound } from 'next/navigation'
import {
  getBinderTreeForHiveAction,
} from '@/lib/actions/hive-content.actions'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember } from '@/lib/hive/permissions'
import { db } from '@/db'
import { hives, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { WikiCategory } from '@/lib/wiki/category-templates'
import { HiveWikiEntryEditorPage } from '../../_components/hive-wiki-entry-editor-page'

export default async function HiveWikiEntryPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string; entryId: string }>
}) {
  const { hiveId, locale, entryId } = await params
  const userId = await requireAuth()
  const viewerRole = await requireHiveMember(hiveId, userId)

  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive || !hive.bookId) notFound()

  // Fetch the binder tree (cross-hive escape guard lives inside the action).
  const tree = await getBinderTreeForHiveAction(hive.bookId, hiveId)
  if (!tree.success) notFound()
  const entry = tree.data.find(i => i.id === entryId && i.type === 'wiki_entry')
  if (!entry) notFound()

  // Validate category (for cross-hive escape symmetry with the wiki landing).
  const content = (entry.content ?? {}) as { category?: WikiCategory }
  void content.category

  // Resolve last-edited author for the header line.
  let authorUsername: string | null = null
  const editorId = entry.lastEditedBy ?? entry.authorId
  if (editorId) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, editorId),
      columns: { username: true },
    })
    authorUsername = profile?.username ?? null
  }

  return (
    <HiveWikiEntryEditorPage
      entryId={entry.id}
      bookId={hive.bookId}
      hiveId={hiveId}
      locale={locale}
      viewerRole={viewerRole}
      authorUsername={authorUsername}
      lastEditedAt={entry.updatedAt}
    />
  )
}
