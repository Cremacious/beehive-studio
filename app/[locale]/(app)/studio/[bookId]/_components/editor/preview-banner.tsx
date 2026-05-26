'use client'

import { useState } from 'react'
import { History } from 'lucide-react'
import { useBookEditor } from '../book-editor-provider'
import { restoreSnapshotAction } from '@/lib/actions/snapshot.actions'

function formatBannerDate(d: Date): string {
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `today ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

export function PreviewBanner() {
  const {
    previewSnapshotId,
    previewSnapshotCreatedAt,
    exitPreview,
    activeChapter,
    pushFlash,
    reloadActiveChapter,
  } = useBookEditor()
  const [restoring, setRestoring] = useState(false)

  if (!previewSnapshotId || !previewSnapshotCreatedAt || !activeChapter) return null

  const snapshotId = previewSnapshotId
  const snapshotCreatedAt = previewSnapshotCreatedAt

  async function handleRestore() {
    if (restoring) return
    setRestoring(true)
    const result = await restoreSnapshotAction(snapshotId)
    setRestoring(false)
    if (result.success) {
      // Exit preview first so the editor effect won't fight the reload, then
      // refetch the live chapter so the editor picks up the restored content.
      exitPreview()
      await reloadActiveChapter()
      pushFlash(`Restored to ${formatBannerDate(snapshotCreatedAt)}`)
    } else if (result.error.startsWith('PREMIUM_REQUIRED')) {
      pushFlash('Premium required to restore')
    } else {
      pushFlash(`Restore failed: ${result.error}`)
    }
  }

  return (
    <div
      data-slot="preview-banner"
      className="flex items-center justify-between gap-3 px-4 py-2 border-b border-brand/40 bg-brand/10 text-xs"
    >
      <div className="flex items-center gap-2 text-foreground">
        <History size={14} className="text-brand" />
        <span>
          Previewing version from <strong>{formatBannerDate(snapshotCreatedAt)}</strong> · read-only
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="rounded px-2.5 py-1 text-xs font-semibold bg-brand hover:bg-brand-hover text-background transition-colors disabled:opacity-50"
        >
          {restoring ? 'Restoring…' : 'Restore this version'}
        </button>
        <button
          onClick={exitPreview}
          disabled={restoring}
          className="rounded px-2.5 py-1 text-xs text-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
        >
          Back to current
        </button>
      </div>
    </div>
  )
}
