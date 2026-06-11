'use client'

import Link from 'next/link'
import { ArrowRight, Globe, Lock, Users } from 'lucide-react'
import type { SparkCard } from '@/lib/actions/discover-sparks.actions'

function timeLeftLabel(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return 'Just now'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

function statusToken(status: SparkCard['status']): string {
  if (status === 'OPEN') return 'var(--spark-status-open)'
  if (status === 'VOTING') return 'var(--brand)'
  return 'var(--canvas-dark-ink-muted)'
}

function statusLabel(status: SparkCard['status']): string {
  if (status === 'OPEN') return 'Open'
  if (status === 'VOTING') return 'Voting'
  return 'Closed'
}

function ctaLabel(status: SparkCard['status']): string {
  if (status === 'OPEN') return 'Enter'
  if (status === 'VOTING') return 'Vote'
  return 'Read winner'
}

const VIS_META = {
  PUBLIC: { label: 'Public', Icon: Globe },
  FRIENDS: { label: 'Friends', Icon: Users },
  PRIVATE: { label: 'Private', Icon: Lock },
} as const

type Variant = 'rail' | 'grid' | 'row'

type Props = {
  spark: SparkCard
  locale: string
  variant?: Variant
}

export function DiscoverSparkCard({ spark, locale, variant = 'grid' }: Props) {
  const accent = statusToken(spark.status)
  const isClosed = spark.status === 'CLOSED'
  const countdownSource =
    spark.status === 'OPEN'
      ? spark.deadline
      : spark.status === 'VOTING'
        ? spark.votingEndsAt
        : null
  const countdownLabel = countdownSource ? timeLeftLabel(countdownSource) : ''
  const vis = VIS_META[spark.visibility]
  const VisIcon = vis.Icon

  const widthClass =
    variant === 'rail'
      ? 'w-[320px] shrink-0'
      : variant === 'row'
        ? 'w-full'
        : 'w-full'

  return (
    <Link
      href={`/${locale}/sparks/${spark.id}`}
      className={`block no-underline ${widthClass}`}
      aria-label={`Open Spark: ${spark.title}`}
    >
      <div
        className="relative transition-transform"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-tile)',
          padding: '24px',
          paddingTop: '27px',
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
        {/* Top status strip */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 24,
            right: 24,
            height: 3,
            background: accent,
            borderRadius: '0 0 2px 2px',
          }}
        />

        <div
          className="grid gap-5 items-center"
          style={{ gridTemplateColumns: '1fr auto' }}
        >
          {/* Main column */}
          <div className="min-w-0">
            {/* Pills row */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
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
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase"
                style={{
                  color: 'var(--canvas-dark-ink-muted)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 'var(--r-pill)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                }}
              >
                <VisIcon size={10} aria-hidden />
                {vis.label}
              </span>
            </div>

            {/* Prompt */}
            <p
              className="text-[19px] italic line-clamp-3"
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

            {/* Author + meta row */}
            <div className="flex items-center gap-3">
              <AuthorAvatar
                avatarUrl={spark.creatorAvatarUrl}
                username={spark.creatorUsername}
                size={32}
              />
              <div className="min-w-0 flex flex-col">
                <span
                  className="text-[13px] font-semibold truncate"
                  style={{
                    color: 'var(--canvas-dark-ink-strong)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {spark.creatorDisplayName ??
                    spark.creatorUsername ??
                    'Unknown'}
                </span>
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
                className="flex items-center gap-3 ml-auto text-[10px]"
                style={{
                  color: 'var(--canvas-dark-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span>
                  {spark.entryCount}{' '}
                  {spark.entryCount === 1 ? 'entry' : 'entries'}
                </span>
                {spark.status === 'VOTING' || isClosed ? (
                  <span>
                    {spark.voteTotal}{' '}
                    {spark.voteTotal === 1 ? 'vote' : 'votes'}
                  </span>
                ) : null}
                {isClosed && spark.winnerUsername ? (
                  <span
                    style={{ color: 'var(--brand)', fontWeight: 700 }}
                  >
                    🏆 @{spark.winnerUsername}
                  </span>
                ) : countdownLabel ? (
                  <span style={{ color: accent, fontWeight: 700 }}>
                    {countdownLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* CTA column */}
          <div className="shrink-0">
            <span
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold whitespace-nowrap"
              style={{
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                borderRadius: 'var(--r-pill)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {ctaLabel(spark.status)}
              <ArrowRight size={13} aria-hidden />
            </span>
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
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      {initial}
    </span>
  )
}
