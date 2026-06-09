'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Users, Hexagon, Search } from 'lucide-react'
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
      <section className="panel">
        <div className="empty">
          <span className="glyph">
            <Users />
          </span>
          <h2>Your feed is quiet for now</h2>
          <p>
            Follow some writers and join a hive — once you&apos;ve got friends, their new
            chapters, sparks, and lists will show up right here.
          </p>
          <div className="cta-row">
            <Link href={`/${locale}/friends?tab=suggested`} className="btn-brand">
              <Search />
              Find friends
            </Link>
            <Link href={`/${locale}/discover`} className="btn-tile">
              <Hexagon />
              Discover hives
            </Link>
          </div>
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
