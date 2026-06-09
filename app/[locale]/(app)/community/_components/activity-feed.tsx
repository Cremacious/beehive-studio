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
            Follow some writers and join a hive — once you&apos;ve got friends, their
            new chapters, sparks, and lists will show up right here.
          </p>
          <div className="cta-row">
            <Link href={`/${locale}/friends?tab=suggested`} className="btn-brand">
              <Search />
              Find Friends
            </Link>
            <Link href={`/${locale}/discover`} className="btn-tile">
              <Hexagon />
              Discover Hives
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel" aria-label="Activity feed">
      <div className="panel-pad" style={{ paddingBottom: 6 }}>
        <div className="sec-head" style={{ marginBottom: 4 }}>
          <h2>Activity</h2>
        </div>
      </div>
      <ul className="cstack" style={{ gap: 0, padding: '0 6px 6px' }}>
        {rows.map((row) => (
          <ActivityEventRow key={row.id} row={row} locale={locale} />
        ))}
      </ul>
      <div className="panel-pad" style={{ paddingTop: 0 }}>
        {cursor ? (
          <button
            type="button"
            onClick={loadOlder}
            disabled={pending}
            className="load-more"
          >
            {pending ? 'Loading…' : 'Load more'}
          </button>
        ) : (
          <p
            style={{ color: 'rgb(255 255 255 / 0.9)' }}
            className="py-2 text-center text-xs"
          >
            You&apos;re all caught up.
          </p>
        )}
      </div>
    </section>
  )
}
