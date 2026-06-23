'use client'

import { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import {
  getChapterSnapshotsAction,
  getSnapshotContentAction,
  type SnapshotSummary,
} from '@/lib/actions/snapshot.actions'
import { EmptyState } from '../empty-state'
import { UpgradePrompt } from '@/components/upgrade/upgrade-prompt'

function formatSnapshotDate(d: Date): string {
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yest.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today ${time}`
  if (isYesterday) return `Yesterday ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`
}

export function VersionHistoryDrawer() {
  const { activeChapter, toggleHistory, enterPreview, pushFlash, previewSnapshotId } = useBookEditor()
  const params = useParams<{ locale: string }>()
  const locale = params.locale
  const [snapshots, setSnapshots] = useState<SnapshotSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function handleRowClick(s: SnapshotSummary) {
    if (openingId) return
    setOpeningId(s.id)
    const result = await getSnapshotContentAction(s.id)
    setOpeningId(null)
    if (result.success) {
      enterPreview({
        id: result.data.id,
        content: result.data.content,
        createdAt: new Date(result.data.createdAt),
      })
    } else if (result.error.startsWith('PREMIUM_REQUIRED')) {
      pushFlash('Premium required to preview')
    } else {
      pushFlash(`Couldn't open snapshot: ${result.error}`)
    }
  }

  useEffect(() => {
    if (!activeChapter) {
      setSnapshots(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void getChapterSnapshotsAction(activeChapter.id).then(result => {
      if (cancelled) return
      if (result.success) {
        // Server already orders newest-first and limits to 50.
        setSnapshots(result.data)
      } else {
        setError(result.error)
        setSnapshots(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [activeChapter])

  const isFreeTier = error?.startsWith('PREMIUM_REQUIRED') ?? false

  return (
    <aside
      data-slot="version-history-drawer"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
    >
      <div
        className="flex items-center gap-2.5 px-4 py-3.5"
        style={{ borderBottom: 'var(--br-card)' }}
      >
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-md"
          style={{ background: 'var(--brand-soft)', color: 'var(--color-brand)' }}
        >
          <Clock size={14} />
        </span>
        <div className="flex-1">
          <h2
            className="text-sm font-bold leading-tight"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.005em', color: 'var(--brand)' }}
          >
            Version history
          </h2>
          <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">
            Snapshots
          </p>
        </div>
        <button
          onClick={toggleHistory}
          aria-label="Close version history"
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="px-4 py-3 text-xs text-muted-foreground">Loading…</p>
        )}

        {!loading && !activeChapter && (
          <p className="px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            Open a chapter to see its version history.
          </p>
        )}

        {!loading && isFreeTier && (
          <div className="p-3.5">
            <UpgradePrompt feature="version-history" locale={locale} isAuthed />
          </div>
        )}

        {!loading && !isFreeTier && error && (
          <p className="px-4 py-3 text-xs text-destructive">
            Couldn&apos;t load history: {error}
          </p>
        )}

        {!loading && snapshots && snapshots.length === 0 && (
          <EmptyState
            icon={<Clock size={20} />}
            title="No snapshots yet"
            body="Keep writing and your chapters will be saved here automatically every minute."
          />
        )}

        {!loading && snapshots && snapshots.length > 0 && (
          <ul className="flex flex-col gap-1.5 px-2 py-3">
            {snapshots.map(s => {
              const isActive = previewSnapshotId === s.id
              return (
                <li key={s.id}>
                  <button
                    onClick={() => handleRowClick(s)}
                    disabled={openingId === s.id}
                    className={cn(
                      'w-full text-left px-3 py-2 transition-colors disabled:opacity-50',
                      !isActive &&
                        'hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]',
                    )}
                    style={{
                      borderRadius: 'var(--r-row)',
                      background: isActive
                        ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                        : undefined,
                      boxShadow: isActive ? 'var(--sh-tile)' : undefined,
                      borderLeft: isActive
                        ? '2px solid var(--brand)'
                        : '2px solid transparent',
                    }}
                  >
                    <div
                      className="text-xs font-mono tracking-wide"
                      style={{ color: isActive ? 'var(--color-brand)' : 'var(--foreground)' }}
                    >
                      {formatSnapshotDate(new Date(s.createdAt))}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {s.wordCount.toLocaleString()} words
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
