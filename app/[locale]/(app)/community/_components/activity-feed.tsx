'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { getCommunityFeedAction, type FeedRow } from '@/lib/actions/community.actions'
import { ActivityEventRow } from './activity-event-row'

export function ActivityFeed({
  initialRows,
  initialCursor,
  locale,
}: {
  initialRows: FeedRow[]
  initialCursor: string | null
  locale: string
}) {
  const [rows, setRows] = useState(initialRows)
  const [cursor, setCursor] = useState(initialCursor)
  const [pending, startTransition] = useTransition()

  function loadOlder() {
    if (!cursor) return
    startTransition(async () => {
      const res = await getCommunityFeedAction({ cursor, limit: 20 })
      if (res.success) {
        setRows((prev) => [...prev, ...res.data.rows])
        setCursor(res.data.nextCursor)
      }
    })
  }

  if (rows.length === 0) {
    return (
      <section
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="flex flex-col items-center gap-3 p-8 text-center"
      >
        <p
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
          className="text-sm font-semibold"
        >
          Your feed is quiet right now
        </p>
        <p
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
          className="max-w-md text-xs"
        >
          Add friends or follow writers to fill your feed.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Link
            href={`/${locale}/friends`}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              borderRadius: 'var(--r-pill)',
            }}
            className="px-4 py-2 text-xs font-semibold"
          >
            Find friends
          </Link>
          <Link
            href={`/${locale}/discover`}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              borderRadius: 'var(--r-pill)',
            }}
            className="px-4 py-2 text-xs font-semibold"
          >
            Discover writers
          </Link>
        </div>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <ActivityEventRow key={row.id} row={row} locale={locale} />
      ))}
      {cursor ? (
        <button
          type="button"
          onClick={loadOlder}
          disabled={pending}
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            borderRadius: 'var(--r-pill)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
          className="self-center px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {pending ? 'Loading…' : 'Load older'}
        </button>
      ) : (
        <p
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
          className="py-2 text-center text-xs"
        >
          You&apos;re all caught up.
        </p>
      )}
    </div>
  )
}
