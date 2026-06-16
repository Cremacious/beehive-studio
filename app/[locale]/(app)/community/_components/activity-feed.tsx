'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Zap, BookMarked, Users } from 'lucide-react'
import {
  getCommunityFeedAction,
  type FeedRow,
} from '@/lib/actions/community.actions'
import type { FallbackNudges } from '@/lib/actions/community-hub.shared'
import { ActivityEventRow } from './activity-event-row'

export function ActivityFeed({
  initialRows,
  initialCursor,
  locale,
  fallbacks,
}: {
  initialRows: FeedRow[]
  initialCursor: string | null
  locale: string
  fallbacks: FallbackNudges
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
      className="flex-1 min-h-0 flex flex-col rounded-[18px] overflow-hidden h-full"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 22px rgba(0,0,0,0.4)',
      }}
    >
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-base font-bold text-[var(--brand)] font-[family-name:var(--font-display)]">
          Activity
        </h2>
      </div>

      {isEmpty ? (
        <FeedEmptyNudges fallbacks={fallbacks} locale={locale} />
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
                className="w-full py-2 rounded-[14px] bg-white/[0.04] hover:bg-white/[0.08] text-xs text-[var(--canvas-dark-ink)] disabled:opacity-50"
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

function FeedEmptyNudges({
  fallbacks,
  locale,
}: {
  fallbacks: FallbackNudges
  locale: string
}) {
  const cards: Array<{
    href: string
    icon: React.ReactNode
    iconBg: string
    title: string
    meta: string
    cta: string
    ctaStyle: 'brand' | 'tile'
  }> = []

  if (fallbacks.todaysSparkTitle && fallbacks.todaysSparkId) {
    cards.push({
      href: `/${locale}/sparks/${fallbacks.todaysSparkId}`,
      icon: <Zap className="h-4 w-4" />,
      iconBg: 'rgba(255,195,0,0.12)',
      title: `Today's Spark prompt is live`,
      meta: `"${fallbacks.todaysSparkTitle}" · ${fallbacks.todaysSparkEntryCount} ${fallbacks.todaysSparkEntryCount === 1 ? 'entry' : 'entries'}`,
      cta: 'Enter →',
      ctaStyle: 'brand',
    })
  }

  if (fallbacks.openClubName && fallbacks.openClubId) {
    cards.push({
      href: `/${locale}/clubs/${fallbacks.openClubId}`,
      icon: <BookMarked className="h-4 w-4" />,
      iconBg: 'rgba(122,95,165,0.18)',
      title: `"${fallbacks.openClubName}" is open to new members`,
      meta: fallbacks.openClubCurrentBookTitle
        ? `Reading ${fallbacks.openClubCurrentBookTitle}`
        : 'No current book yet',
      cta: 'Join →',
      ctaStyle: 'tile',
    })
  }

  if (fallbacks.suggestedWriterCount > 0) {
    cards.push({
      href: `/${locale}/friends?tab=find`,
      icon: <Users className="h-4 w-4" />,
      iconBg: 'rgba(95,165,122,0.18)',
      title: `${fallbacks.suggestedWriterCount} ${fallbacks.suggestedWriterCount === 1 ? 'writer' : 'writers'} to follow`,
      meta: 'Hand-picked from the wider community',
      cta: 'See →',
      ctaStyle: 'tile',
    })
  }

  // If even the discoverable pool is empty, show a friendly fallback.
  if (cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6 pb-12">
        <div className="text-2xl mb-1">🐝</div>
        <div className="font-bold text-[var(--canvas-dark-ink-strong)] text-sm">
          It&apos;s quiet in here for now
        </div>
        <p className="text-xs text-[var(--canvas-dark-ink-muted)] max-w-xs leading-relaxed">
          When writers ship chapters, win Sparks, or curate lists, you&apos;ll see
          it all here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 overflow-y-auto">
      <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-2 px-1">
        From the wider community
      </div>
      <div className="flex flex-col gap-2">
        {cards.map((card, i) => (
          <Link
            key={i}
            href={card.href}
            className="flex items-center gap-3 p-3 rounded-[14px] hover:bg-white/[0.04] transition-colors"
            style={{ background: 'rgba(255,255,255,0.025)' }}
          >
            <div
              className="h-9 w-9 rounded-[10px] flex items-center justify-center text-[var(--brand)] flex-shrink-0"
              style={{ background: card.iconBg }}
            >
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--canvas-dark-ink-strong)] truncate">
                {card.title}
              </div>
              <div className="text-[10px] text-[var(--canvas-dark-ink-muted)] truncate mt-0.5">
                {card.meta}
              </div>
            </div>
            <span
              className={
                card.ctaStyle === 'brand'
                  ? 'px-3 py-1.5 rounded-full bg-[var(--brand)] text-[var(--brand-ink)] text-[10px] font-bold whitespace-nowrap'
                  : 'px-3 py-1.5 rounded-full bg-white/[0.06] text-[var(--canvas-dark-ink)] text-[10px] whitespace-nowrap'
              }
            >
              {card.cta}
            </span>
          </Link>
        ))}
      </div>
      <p className="text-[10px] text-center text-[var(--canvas-dark-ink-muted)] mt-auto pt-6 italic">
        Once you follow writers and join hives, your real activity feed will live
        here.
      </p>
    </div>
  )
}
