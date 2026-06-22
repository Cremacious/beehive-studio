'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  listClubDiscussionsAction,
  type ClubDiscussionRow,
} from '@/lib/actions/book-clubs.actions'
import { DiscussionRow, SectionLabel } from './discussion-row'

export function DiscussionsList({
  clubId,
  locale,
  initialRows,
  initialCursor,
}: {
  clubId: string
  locale: string
  initialRows: ClubDiscussionRow[]
  initialCursor: string | null
}) {
  const [rows, setRows] = useState<ClubDiscussionRow[]>(initialRows)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [allLoaded, setAllLoaded] = useState(initialCursor === null)
  const [pending, startTransition] = useTransition()

  if (rows.length === 0) return null

  function loadOlder() {
    if (!cursor) return
    startTransition(async () => {
      const result = await listClubDiscussionsAction({
        clubId,
        cursor,
        limit: 50,
      })
      if (!result.success) {
        toast.error('Could not load older discussions')
        return
      }
      const seen = new Set(rows.map((r) => r.id))
      const fresh = result.data.rows.filter((r) => !r.isPinned && !seen.has(r.id))
      setRows((prev) => [...prev, ...fresh])
      setCursor(result.data.nextCursor)
      if (result.data.nextCursor === null) setAllLoaded(true)
    })
  }

  return (
    <>
      <SectionLabel label="All discussions" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((d) => (
          <DiscussionRow key={d.id} d={d} locale={locale} clubId={clubId} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
        {allLoaded ? (
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--canvas-dark-ink-muted)',
              fontStyle: 'italic',
            }}
          >
            — that's everything —
          </span>
        ) : (
          <button
            type="button"
            onClick={loadOlder}
            disabled={pending}
            style={{
              background: 'transparent',
              border: '1px dashed rgba(255,255,255,0.18)',
              borderRadius: 999,
              padding: '7px 18px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--canvas-dark-ink-muted)',
              cursor: pending ? 'wait' : 'pointer',
              opacity: pending ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            {pending ? 'Loading…' : 'Load older ↓'}
          </button>
        )}
      </div>
    </>
  )
}
