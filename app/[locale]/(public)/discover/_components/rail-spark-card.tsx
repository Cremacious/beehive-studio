'use client'

import Link from 'next/link'
import type { SparkCard } from '@/lib/actions/discover-sparks.actions'
import {
  timeLeftLabel,
  statusToken,
  statusLabel,
} from '@/lib/sparks/spark-card-helpers'

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000

type Props = {
  spark: SparkCard
  locale: string
  /** Live Now rail passes true; rail filters per-card on (deadline - now) <= 48h */
  showUrgencyCaption?: boolean
}

export function RailSparkCard({ spark, locale, showUrgencyCaption }: Props) {
  const isClosed = spark.status === 'CLOSED'
  const countdownSource =
    spark.status === 'OPEN'
      ? spark.deadline
      : spark.status === 'VOTING'
        ? spark.votingEndsAt
        : null
  const countdownLabel = countdownSource ? timeLeftLabel(countdownSource) : ''
  const accent = statusToken(spark.status)

  const showCaption =
    showUrgencyCaption &&
    spark.deadline !== null &&
    spark.deadline.getTime() - Date.now() <= FORTY_EIGHT_HOURS_MS &&
    spark.deadline.getTime() > Date.now()

  return (
    <Link
      href={`/${locale}/sparks/${spark.id}`}
      className="block no-underline w-[260px] shrink-0"
      aria-label={`Open Spark: ${spark.title}`}
    >
      <div
        className="relative transition-transform"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-tile)',
          padding: '22px',
          paddingTop: '25px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow =
            '0 6px 18px rgb(0 0 0 / 0.35), 0 2px 4px rgb(0 0 0 / 0.25)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = 'var(--sh-tile)'
        }}
      >
        {/* Status-colored top strip */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 22,
            right: 22,
            height: 3,
            background: accent,
            borderRadius: '0 0 2px 2px',
          }}
        />

        {/* Pills row */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase"
            style={{
              background: `oklch(from ${accent} l c h / 0.18)`,
              color: accent,
              borderRadius: 'var(--r-pill)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.1em',
            }}
          >
            {statusLabel(spark.status)}
          </span>
          {spark.genre ? (
            <span
              className="inline-flex items-center px-2 py-0.5 text-[9px] uppercase"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 'var(--r-pill)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
              }}
            >
              {spark.genre}
            </span>
          ) : null}
        </div>

        {/* Optional urgency caption */}
        {showCaption ? (
          <p
            className="text-[9px] uppercase mb-2"
            style={{
              color: 'var(--brand)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.12em',
              fontWeight: 700,
            }}
          >
            Closing soon
          </p>
        ) : null}

        {/* Quote-forward serif prompt */}
        <p
          className="text-[17px] italic line-clamp-2"
          style={{
            fontFamily: 'var(--font-prose)',
            color: 'var(--canvas-dark-ink-strong)',
            lineHeight: 1.4,
            marginBottom: '18px',
          }}
        >
          <span
            aria-hidden
            style={{
              color: 'var(--brand)',
              fontWeight: 700,
              marginRight: '2px',
            }}
          >
            “
          </span>
          {spark.title}
        </p>

        {/* Hairline divider */}
        <div
          aria-hidden
          style={{
            height: 1,
            background: 'rgba(255,255,255,0.06)',
            marginBottom: '14px',
          }}
        />

        {/* Meta row */}
        <div
          className="flex items-center justify-between text-[10px]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {/* Left: avatar + @username */}
          <div className="flex items-center gap-2 min-w-0">
            <AuthorAvatar
              avatarUrl={spark.creatorAvatarUrl}
              username={spark.creatorUsername}
              size={18}
            />
            <span className="truncate">
              @{spark.creatorUsername ?? 'unknown'}
            </span>
          </div>

          {/* Right: entries pill + countdown OR winner badge */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center px-1.5 py-0.5"
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 'var(--r-pill)',
              }}
            >
              {spark.entryCount} {spark.entryCount === 1 ? 'entry' : 'entries'}
            </span>
            {isClosed && spark.winnerUsername ? (
              <span
                className="inline-flex items-center gap-1"
                style={{ color: 'var(--brand)', fontWeight: 700 }}
              >
                🏆 @{spark.winnerUsername} won
              </span>
            ) : countdownLabel ? (
              <span
                style={{
                  color: accent,
                  fontWeight: 700,
                }}
              >
                {countdownLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}

function AuthorAvatar({
  avatarUrl,
  username,
  size,
}: {
  avatarUrl: string | null
  username: string | null
  size: number
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  const initial = (username ?? '?').charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background:
          'linear-gradient(135deg, var(--brand), oklch(0.78 0.13 70))',
        color: 'var(--brand-ink)',
        fontFamily: 'var(--font-display)',
        fontSize: Math.round(size * 0.55),
        fontWeight: 700,
      }}
    >
      {initial}
    </span>
  )
}
