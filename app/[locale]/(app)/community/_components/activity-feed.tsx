'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Sparkles } from 'lucide-react'
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

  const isEmpty = rows.length === 0

  return (
    <section
      aria-label="Activity feed"
      className="flex-1 min-h-0 flex flex-col rounded-[var(--r-card)] border border-[var(--br-card)] overflow-hidden h-full"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
      }}
    >
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--brand)] font-[family-name:var(--font-display)]">
          Activity
        </h2>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 pb-12">
          <div className="h-14 w-14 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)]">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="font-bold text-[var(--canvas-dark-ink-strong)] text-base mt-1">
            Your feed will fill in here
          </div>
          <p className="text-sm text-[var(--canvas-dark-ink-muted)] max-w-xs leading-relaxed">
            Join a Hive, follow writers, or try a Spark to see activity from
            your community.
          </p>
          <div className="flex gap-2 mt-3">
            <Link
              href={`/${locale}/sparks`}
              className="px-4 py-2 rounded-full bg-[var(--brand)] text-[var(--brand-ink)] text-xs font-bold hover:brightness-110"
            >
              Try a Spark →
            </Link>
            <Link
              href={`/${locale}/friends?tab=find`}
              className="px-4 py-2 rounded-full bg-white/[0.06] text-[var(--canvas-dark-ink)] text-xs hover:bg-white/[0.1]"
            >
              Find friends →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 list-none m-0">
            {rows.map((row) => (
              <ActivityEventRow key={row.id} row={row} locale={locale} />
            ))}
          </ul>
          <div className="px-5 pb-4 pt-1">
            {cursor ? (
              <button
                type="button"
                onClick={loadOlder}
                disabled={pending}
                className="w-full py-2 rounded-[var(--r-row)] bg-white/[0.04] hover:bg-white/[0.08] text-xs text-[var(--canvas-dark-ink)] disabled:opacity-50"
              >
                {pending ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <p className="py-2 text-center text-xs text-[var(--canvas-dark-ink-muted)]">
                You&apos;re all caught up.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
