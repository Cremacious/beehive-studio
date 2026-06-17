'use client'

import Link from 'next/link'
import type { SparkCard as SparkCardData } from '@/lib/actions/discover-sparks.actions'
import type { CommunitySparkSource } from '@/lib/actions/sparks-hub.actions'
import { truncateAtWord } from '@/lib/sparks/truncate-at-word'
import {
  timeLeftLabel,
  statusToken,
  statusLabel,
} from '@/lib/sparks/spark-card-helpers'

type Props = {
  spark: SparkCardData
  locale: string
  /** sm = 240px target width, md = 280px target (default). */
  size?: 'sm' | 'md'
  sourceTag?: CommunitySparkSource | null
}

const TEASER_MAX = 80

const SOURCE_TAG_STYLE: Record<
  CommunitySparkSource,
  { bg: string; color: string; label: string }
> = {
  yours: {
    bg: 'oklch(from var(--brand) l c h / 0.15)',
    color: 'var(--brand)',
    label: 'YOURS',
  },
  following: {
    bg: 'oklch(0.6 0.15 240 / 0.15)',
    color: 'oklch(0.7 0.15 240)',
    label: 'FOLLOWING',
  },
  friend: {
    bg: 'oklch(0.55 0.18 310 / 0.15)',
    color: 'oklch(0.7 0.18 310)',
    label: 'FRIEND',
  },
  entered: {
    bg: 'oklch(0.6 0.15 150 / 0.15)',
    color: 'oklch(0.7 0.15 150)',
    label: 'ENTERED',
  },
}

export function SparkCard({ spark, locale, size = 'md', sourceTag }: Props) {
  const isOpen = spark.status === 'OPEN'
  const isVoting = spark.status === 'VOTING'
  const isClosed = spark.status === 'CLOSED'

  const accent = statusToken(spark.status)

  // Countdown source per status: OPEN tracks deadline, VOTING tracks votingEndsAt,
  // CLOSED shows no countdown.
  const countdownDate = isOpen ? spark.deadline : isVoting ? spark.votingEndsAt : null
  const countdownLabel = countdownDate ? timeLeftLabel(countdownDate) : ''

  const teaser =
    spark.prompt && spark.prompt.length > 0
      ? truncateAtWord(spark.prompt, TEASER_MAX)
      : null

  const titleSize = size === 'sm' ? 'text-[15px]' : 'text-[17px]'

  return (
    <Link
      href={`/${locale}/community/sparks/${spark.id}`}
      className="block no-underline w-full h-full transition-transform hover:-translate-y-px"
      aria-label={`Open Spark: ${spark.title}`}
    >
      <div
        className="overflow-hidden h-full flex flex-col"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: '14px',
          boxShadow: 'var(--sh-tile)',
        }}
      >
        {/* 3px status-color top strip */}
        <div aria-hidden="true" style={{ height: '3px', background: accent }} />

        <div className="p-4 flex-1 flex flex-col">
          {/* Header row: status pill + genre label */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded-full"
              style={{
                background: `oklch(from ${accent} l c h / 0.15)`,
                color: accent,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {isOpen && <span aria-hidden="true">⚡</span>}
              {isVoting && <span aria-hidden="true">🗳</span>}
              {isClosed && <span aria-hidden="true">○</span>}
              {statusLabel(spark.status)}
              {countdownLabel ? ` · ${countdownLabel}` : ''}
            </span>
            {sourceTag ? (
              <span
                className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded-full"
                style={{
                  background: SOURCE_TAG_STYLE[sourceTag].bg,
                  color: SOURCE_TAG_STYLE[sourceTag].color,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {SOURCE_TAG_STYLE[sourceTag].label}
              </span>
            ) : spark.genre ? (
              <span
                className="text-[9px] uppercase tracking-[0.08em]"
                style={{
                  color: 'var(--canvas-dark-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {spark.genre}
              </span>
            ) : null}
          </div>

          {/* Title — Comfortaa bold, line-clamp-2, min-height to reserve 2 lines */}
          <h4
            className={`${titleSize} font-bold leading-tight line-clamp-2`}
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
              minHeight: '2.6em',
              marginBottom: '6px',
            }}
          >
            {spark.title}
          </h4>

          {/* Prompt teaser — Newsreader italic 11px, min-height for uniformity */}
          {teaser ? (
            <p
              className="text-[11px] italic mb-3"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-prose)',
                lineHeight: 1.4,
                minHeight: '2.6em',
              }}
            >
              {teaser}
            </p>
          ) : (
            <div style={{ minHeight: '2.6em', marginBottom: '12px' }} aria-hidden="true" />
          )}

          {/* Hairline divider + meta footer */}
          <div
            className="flex items-center justify-between pt-3"
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {spark.creatorAvatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={spark.creatorAvatarUrl}
                  alt=""
                  className="w-[18px] h-[18px] rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-[18px] h-[18px] rounded-full flex-shrink-0"
                  style={{ background: 'var(--canvas-dark-100)' }}
                  aria-hidden="true"
                />
              )}
              <span
                className="text-[10px] truncate"
                style={{
                  color: 'var(--canvas-dark-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                @{spark.creatorUsername ?? 'unknown'}
              </span>
            </div>
            <div
              className="text-[10px] flex-shrink-0"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {spark.entryCount} {spark.entryCount === 1 ? 'entry' : 'entries'}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
