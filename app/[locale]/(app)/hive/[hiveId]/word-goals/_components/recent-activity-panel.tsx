'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
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

  if (items.length === 0) {
    return (
      <p className="text-sm italic text-[var(--canvas-dark-ink-muted)] py-2">
        No activity yet.
      </p>
    )
  }

  return (
    <div>
      <div className="flex flex-col">
        {items.map((item) => {
          const profileHref = item.user.username
            ? `/${locale}/u/${item.user.username}`
            : null
          const positive = item.wordsAdded > 0
          const handle = item.user.username ? `@${item.user.username}` : 'Unknown writer'
          return (
            <div
              key={item.id}
              className="flex items-baseline gap-3"
              style={{
                padding: '9px 0',
                borderTop:
                  '1px solid oklch(from var(--canvas-dark-300) l c h / 0.4)',
              }}
            >
              <span
                className="font-mono text-[11px] uppercase tracking-wider flex-shrink-0 text-right"
                style={{ width: '64px', color: 'var(--canvas-dark-ink-muted)' }}
              >
                {relTime(item.loggedAt)}
              </span>
              <span
                className="flex-1 text-[13.5px]"
                style={{ color: 'var(--canvas-dark-ink)' }}
              >
                {profileHref ? (
                  <Link
                    href={profileHref}
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--canvas-dark-ink-strong)' }}
                  >
                    {handle}
                  </Link>
                ) : (
                  <span
                    className="font-semibold"
                    style={{ color: 'var(--canvas-dark-ink-strong)' }}
                  >
                    {handle}
                  </span>
                )}{' '}
                logged{' '}
                <span
                  className="font-semibold"
                  style={{ color: 'var(--canvas-dark-ink-strong)' }}
                >
                  {positive ? '+' : ''}
                  {item.wordsAdded.toLocaleString()}
                </span>{' '}
                words
                {item.chapterTitle ? (
                  <>
                    {' '}on{' '}
                    <span
                      className="italic"
                      style={{ color: 'var(--canvas-dark-ink-strong)' }}
                    >
                      {item.chapterTitle}
                    </span>
                  </>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
      {cursor && (
        <button
          type="button"
          onClick={loadOlder}
          disabled={pending}
          className="inline-flex items-center font-semibold text-[13px] hover:text-[var(--canvas-dark-ink-strong)] transition-[color,transform] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
          style={{
            marginTop: '14px',
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            borderRadius: 'var(--r-pill)',
            padding: '7px 14px',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          {pending ? 'Loading…' : 'Load older'}
        </button>
      )}
    </div>
  )
}
