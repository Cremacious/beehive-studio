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
      className="flex items-center gap-3 mx-4 my-2 px-3.5 py-2.5 text-xs"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
        borderRadius: 'var(--r-card)',
      }}
    >
      <span
        className="inline-flex items-center justify-center w-7 h-7 flex-shrink-0"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          borderRadius: 'var(--r-btn)',
          color: 'var(--brand)',
        }}
      >
        <History size={14} />
      </span>

      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <span style={{ color: 'var(--canvas-dark-ink)' }}>
          Previewing version from{' '}
          <strong
            className="font-mono font-semibold"
            style={{ color: 'var(--canvas-dark-ink-strong)' }}
          >
            {formatBannerDate(snapshotCreatedAt)}
          </strong>
        </span>
        <span
          className="font-mono text-[9px] font-bold uppercase tracking-[0.10em] px-1.5 py-0.5"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            borderRadius: 'var(--r-pill)',
          }}
        >
          read-only
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-btn)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {restoring ? 'Restoring…' : 'Restore this version'}
        </button>
        <button
          onClick={exitPreview}
          disabled={restoring}
          className="px-3 py-1.5 text-xs transition-colors hover:brightness-110 disabled:opacity-50"
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            borderRadius: 'var(--r-btn)',
            color: 'var(--canvas-dark-ink)',
          }}
        >
          Back to current
        </button>
      </div>
    </div>
  )
}
