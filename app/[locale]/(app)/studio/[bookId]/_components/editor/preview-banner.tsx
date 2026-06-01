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
      className="relative flex items-center gap-3.5 mx-4 my-2 pl-4 pr-4 py-2 text-xs"
      style={{
        background:
          'linear-gradient(180deg, oklch(from var(--color-brand) l c h / 0.15), oklch(from var(--color-brand) l c h / 0.08))',
        boxShadow: 'var(--sh-tile), 0 0 24px oklch(from var(--color-brand) l c h / 0.2)',
        border: 'var(--br-card)',
        borderRadius: 'var(--r-card)',
        borderLeft: '4px solid var(--color-brand)',
      }}
    >
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0"
        style={{
          background: 'var(--color-brand)',
          color: 'var(--brand-ink)',
          boxShadow: '0 2px 6px -2px rgba(0,0,0,0.3)',
        }}
      >
        <History size={14} />
      </span>
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <span style={{ color: 'var(--pb-ink, var(--canvas-dark-ink-strong))' }}>
          Previewing version from{' '}
          <strong
            className="font-mono font-semibold"
            style={{ color: 'var(--pb-strong, var(--color-brand))' }}
          >
            {formatBannerDate(snapshotCreatedAt)}
          </strong>
        </span>
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
          style={{
            color: 'var(--pb-ro, var(--color-brand))',
            background: 'oklch(from var(--color-brand) l c h / 0.30)',
          }}
        >
          read-only
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="px-3 py-1.5 text-xs font-bold hover:bg-brand-hover transition-colors disabled:opacity-50"
          style={{
            background: 'var(--color-brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-btn)',
            fontFamily: 'var(--font-display)',
            boxShadow: '0 2px 6px -2px rgba(0,0,0,0.3)',
          }}
        >
          {restoring ? 'Restoring…' : 'Restore this version'}
        </button>
        <button
          onClick={exitPreview}
          disabled={restoring}
          className="px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
          style={{
            background: 'transparent',
            border: '1px solid oklch(from var(--color-brand) l c h / 0.4)',
            borderRadius: 'var(--r-btn)',
            color: 'var(--pb-ghost, var(--canvas-dark-ink-strong))',
          }}
        >
          Back to current
        </button>
      </div>
      {/* Theme-aware bridge so brand-tint text stays readable on cream paper */}
      <style>{`
        [data-slot="preview-banner"] {
          --pb-ink: var(--chrome-100);
          --pb-strong: var(--color-brand);
          --pb-ro: var(--color-brand);
          --pb-ghost: var(--chrome-200);
        }
        [data-editor-theme="light"] [data-slot="preview-banner"] {
          --pb-ink: var(--paper-ink-strong);
          --pb-strong: oklch(0.45 0.13 60);
          --pb-ro: oklch(0.40 0.13 60);
          --pb-ghost: oklch(0.40 0.13 60);
        }
      `}</style>
    </div>
  )
}
