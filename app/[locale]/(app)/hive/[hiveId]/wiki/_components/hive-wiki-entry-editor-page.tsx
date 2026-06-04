'use client'

import { useRouter } from 'next/navigation'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HiveWikiEntryEditor } from './hive-wiki-entry-editor'
import type { HiveRole } from '@/lib/hive/permissions'

/**
 * Wrapper that mounts the entry editor inside a HivePageShell at its own URL.
 *
 * The entry editor owns its own header (edited-by line + save status badge).
 * We deliberately omit the shell's title/subtitle/back so the editor's header
 * is the only top-of-page chrome. Browser back handles navigation.
 */
export function HiveWikiEntryEditorPage({
  entryId,
  bookId,
  hiveId,
  locale,
  viewerRole,
  authorUsername,
  lastEditedAt,
}: {
  entryId: string
  bookId: string
  hiveId: string
  locale: string
  viewerRole: HiveRole
  authorUsername: string | null
  lastEditedAt: Date
}) {
  const router = useRouter()
  const backHref = `/${locale}/hive/${hiveId}/wiki`

  return (
    <HivePageShell width="wide">
      <HiveWikiEntryEditor
        entryId={entryId}
        bookId={bookId}
        hiveId={hiveId}
        viewerRole={viewerRole}
        authorUsername={authorUsername}
        lastEditedAt={lastEditedAt}
        onBack={() => router.push(backHref)}
      />
    </HivePageShell>
  )
}
