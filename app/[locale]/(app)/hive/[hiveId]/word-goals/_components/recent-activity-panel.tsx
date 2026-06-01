'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { User } from 'lucide-react'
import {
  getRecentWordLogsAction,
  type RecentWordLogItem,
} from '@/lib/actions/hive-word-logs.actions'
import { relTime } from '@/components/hive/collab/rel-time'

type Props = {
  hiveId: string
  initialItems: RecentWordLogItem[]
  initialCursor: string | null
  locale: string
}

export function RecentActivityPanel({ hiveId, initialItems, initialCursor, locale }: Props) {
  const [items, setItems] = useState<RecentWordLogItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [pending, startTransition] = useTransition()

  function loadOlder() {
    if (!cursor || pending) return
    startTransition(async () => {
      const result = await getRecentWordLogsAction({ hiveId, cursor, limit: 20 })
      if (!result.success) return
      setItems((prev) => [...prev, ...result.data.items])
      setCursor(result.data.nextCursor)
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="mb-3">
        <h2 className="font-comfortaa font-bold text-base text-foreground">Recent activity</h2>
        <p className="text-xs text-muted-foreground">Latest word-log entries from the hive.</p>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const profileHref = item.user.username ? `/${locale}/u/${item.user.username}` : null
            const positive = item.wordsAdded >= 0
            return (
              <li key={item.id} className="flex items-center gap-2.5 text-sm">
                <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {profileHref ? (
                    <Link href={profileHref} className="font-medium text-foreground hover:underline">
                      {item.user.username}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">Unknown writer</span>
                  )}
                  <span className="text-muted-foreground">
                    {' '}
                    <span
                      className="font-mono"
                      style={{ color: positive ? 'var(--color-brand)' : 'var(--destructive)' }}
                    >
                      {positive ? '+' : ''}
                      {item.wordsAdded.toLocaleString()}
                    </span>{' '}
                    words in{' '}
                    <span className="italic text-foreground/80">
                      {item.chapterTitle ?? 'a chapter'}
                    </span>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {relTime(item.loggedAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {cursor && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={loadOlder}
            disabled={pending}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-foreground/5 disabled:opacity-50"
          >
            {pending ? 'Loading…' : 'Load older'}
          </button>
        </div>
      )}
    </section>
  )
}
