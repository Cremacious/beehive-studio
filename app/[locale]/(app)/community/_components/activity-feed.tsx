'use client'

import { useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getHiveActivityFeedAction, type HiveActivityEvent } from '@/lib/actions/hive-activity.actions'
import { ActivityEventRow } from './activity-event-row'

export function ActivityFeed({
  initialItems,
  initialNextCursor,
}: {
  initialItems: HiveActivityEvent[]
  initialNextCursor: string | null
}) {
  const params = useParams<{ locale: string }>()
  const locale = params.locale
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [pending, startTransition] = useTransition()

  function loadOlder() {
    if (!cursor) return
    startTransition(async () => {
      const res = await getHiveActivityFeedAction({ cursor, limit: 30 })
      if (res.success) {
        setItems(prev => [...prev, ...res.data.items])
        setCursor(res.data.nextCursor)
      }
    })
  }

  if (items.length === 0) {
    return (
      <section className="bg-card border border-border rounded-lg p-6 text-center flex flex-col gap-2">
        <p className="text-sm text-foreground">You&apos;re not in any hives yet.</p>
        <p className="text-xs text-muted-foreground">
          Hives are small writing groups where you swap drafts, leave suggestions, and ship together.
        </p>
        <Link
          href={`/${locale}/studio`}
          className="text-xs px-3 py-1.5 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors inline-block self-center mt-1"
        >
          Find or create a Hive
        </Link>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(e => (
        <ActivityEventRow key={e.id} event={e} locale={locale} />
      ))}

      {cursor ? (
        <button
          onClick={loadOlder}
          disabled={pending}
          className="text-xs px-4 py-2 rounded border border-border text-foreground hover:bg-surface-elevated transition-colors disabled:opacity-50 self-center"
        >
          {pending ? 'Loading…' : 'Load older'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">You&apos;re all caught up.</p>
      )}
    </div>
  )
}
