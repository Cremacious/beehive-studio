'use client'

import { useRouter } from 'next/navigation'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HiveWikiEntryEditor } from './hive-wiki-entry-editor'
import type { HiveRole } from '@/lib/hive/permissions'

/**
 * Wrapper that mounts the entry editor inside a HivePageShell at its own URL.
 *
 * Trade-off: back link points at the wiki landing rather than the source
 * category drill-down — the URL doesn't carry that info and a `?from=...`
 * round-trip felt heavier than the win. If users complain, add the source
 * category as a search param threaded through the cat-card Link → editor flow.
 */
export function HiveWikiEntryEditorPage({
  entryId,
  bookId,
  hiveId,
  locale,
  title,
  categoryLabel,
  viewerRole,
  authorUsername,
  lastEditedAt,
}: {
  entryId: string
  bookId: string
  hiveId: string
  locale: string
  title: string
  categoryLabel: string
  viewerRole: HiveRole
  authorUsername: string | null
  lastEditedAt: Date
}) {
  const router = useRouter()
  const backHref = `/${locale}/hive/${hiveId}/wiki`

  return (
    <HivePageShell
      width="wide"
      back={{ href: backHref, label: 'wiki' }}
      title={title || 'Untitled entry'}
      subtitle={categoryLabel}
    >
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
