'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import type { ContributorBreakdownRow, WordGoalRecord } from '@/lib/actions/hive-word-goals.actions'

type Props = {
  primary: WordGoalRecord | null
  contributors: ContributorBreakdownRow[]
  totalProgress: number
  locale: string
}

export function ContributorsPanel({ primary, contributors, locale }: Props) {
  if (!primary) return null

  if (contributors.length === 0) {
    return (
      <p className="text-sm italic text-[var(--canvas-dark-ink-muted)] py-2">
        No contributions logged yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {contributors.map((c, i) => {
        const profileHref = c.username ? `/${locale}/u/${c.username}` : null
        const initials = (c.username ?? '??').slice(0, 2).toUpperCase()
        const positive = c.wordsContributed > 0
        const negative = c.wordsContributed < 0
        return (
          <div
            key={c.userId}
            className="flex items-center gap-3 py-3"
            style={
              i > 0
                ? {
                    borderTop:
                      '1px solid oklch(from var(--canvas-dark-300) l c h / 0.4)',
                  }
                : undefined
            }
          >
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden text-[10px] font-semibold"
              style={{
                background: 'var(--canvas-dark-100)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              {c.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : c.username ? (
                initials
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
            </div>
            {profileHref ? (
              <Link
                href={profileHref}
                className="font-comfortaa font-medium text-sm hover:underline"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                @{c.username}
              </Link>
            ) : (
              <span
                className="font-comfortaa font-medium text-sm"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                Unknown writer
              </span>
            )}
            <span
              className="ml-auto font-mono text-[13px] font-bold"
              style={{
                color: positive
                  ? 'var(--status-success)'
                  : negative
                  ? 'var(--status-error)'
                  : 'var(--canvas-dark-ink-muted)',
              }}
            >
              {positive ? '+' : ''}
              {c.wordsContributed.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
