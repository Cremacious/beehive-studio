'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import type { ContributorBreakdownRow, WordGoalRecord } from '@/lib/actions/hive-word-goals.actions'
import type { WordGoalType } from '@/lib/hive/goal-progress'

type Props = {
  primary: WordGoalRecord | null
  contributors: ContributorBreakdownRow[]
  totalProgress: number
  locale: string
}

const TYPE_LABEL: Record<WordGoalType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  TOTAL: 'Total',
}

export function ContributorsPanel({ primary, contributors, totalProgress, locale }: Props) {
  if (!primary) return null
  return (
    <div>
      <header className="flex items-center justify-between mb-3">
        <p className="text-xs text-[var(--canvas-dark-ink-muted)]">
          Within the active {TYPE_LABEL[primary.type]} goal&apos;s window.
        </p>
        <span className="text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
          {totalProgress.toLocaleString()} total
        </span>
      </header>
      {contributors.length === 0 ? (
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] py-2">No contributions logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {contributors.map((c) => {
            const pct =
              totalProgress > 0 ? Math.round((c.wordsContributed / totalProgress) * 100) : 0
            const profileHref = c.username ? `/${locale}/u/${c.username}` : null
            const NameTag = profileHref ? Link : 'span'
            return (
              <li key={c.userId} className="flex items-center gap-3">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: 'var(--canvas-dark-100)', boxShadow: 'var(--sh-inset)' }}
                >
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-[var(--canvas-dark-ink-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <NameTag
                      // @ts-expect-error — conditional `href` for Link vs span
                      href={profileHref ?? undefined}
                      className="text-sm text-[var(--canvas-dark-ink-strong)] truncate hover:underline"
                    >
                      {c.username ?? 'Unknown writer'}
                    </NameTag>
                    <span className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] flex-shrink-0">
                      {c.wordsContributed.toLocaleString()}{' '}
                      <span className="opacity-60">· {pct}%</span>
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1 w-full overflow-hidden"
                    style={{
                      background: 'var(--canvas-dark-100)',
                      borderRadius: 'var(--r-pill)',
                      boxShadow: 'var(--sh-inset)',
                    }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${pct}%`,
                        background: 'var(--brand)',
                        borderRadius: 'var(--r-pill)',
                      }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
