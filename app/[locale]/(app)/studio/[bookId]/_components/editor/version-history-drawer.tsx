'use client'

import { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useBookEditor } from '../book-editor-provider'
import {
  getChapterSnapshotsAction,
  getSnapshotContentAction,
  type SnapshotSummary,
} from '@/lib/actions/snapshot.actions'

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
  const { activeChapter, toggleHistory, enterPreview, pushFlash } = useBookEditor()
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
      className="w-60 flex-shrink-0 flex flex-col bg-card border-l border-border overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-foreground/70" />
          <h2 className="text-sm font-medium text-foreground">Version history</h2>
        </div>
        <button
          onClick={toggleHistory}
          aria-label="Close version history"
          className="text-foreground/60 hover:text-foreground transition-colors"
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
          <div className="p-4 flex flex-col gap-3">
            <div className="rounded-md border border-brand/30 bg-brand/5 p-3 flex flex-col gap-2">
              <span className="rounded-sm bg-brand/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand border border-brand/30 self-start">
                Premium
              </span>
              <p className="text-xs text-foreground/80 leading-relaxed">
                Version history lets you restore any version of your chapter going back through your edits.
              </p>
              <Link
                href={`/${locale}/pricing`}
                className="inline-flex items-center justify-center rounded-md bg-brand hover:bg-brand-hover px-3 py-1.5 text-xs font-semibold text-background transition-colors"
              >
                Upgrade →
              </Link>
            </div>
          </div>
        )}

        {!loading && !isFreeTier && error && (
          <p className="px-4 py-3 text-xs text-destructive">
            Couldn&apos;t load history: {error}
          </p>
        )}

        {!loading && snapshots && snapshots.length === 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            No snapshots yet — keep writing and your chapters will be saved here automatically every minute.
          </p>
        )}

        {!loading && snapshots && snapshots.length > 0 && (
          <ul className="flex flex-col">
            {snapshots.map(s => (
              <li key={s.id}>
                <button
                  onClick={() => handleRowClick(s)}
                  disabled={openingId === s.id}
                  className="w-full text-left px-4 py-2 hover:bg-surface-elevated transition-colors border-b border-border/40 disabled:opacity-50"
                >
                  <div className="text-xs text-foreground">
                    {formatSnapshotDate(new Date(s.createdAt))}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {s.wordCount.toLocaleString()} words
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
