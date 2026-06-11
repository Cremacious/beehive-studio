'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
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

type Props = {
  spark: SparkCard
  locale: string
}

export function FeaturedSparkHero({ spark, locale }: Props) {
  const accent = statusToken(spark.status)
  const countdownSource =
    spark.status === 'OPEN'
      ? spark.deadline
      : spark.status === 'VOTING'
        ? spark.votingEndsAt
        : null
  const countdownLabel = countdownSource ? timeLeftLabel(countdownSource) : ''

  return (
    <section
      className="relative overflow-hidden p-7"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200)), radial-gradient(circle at top right, var(--brand-soft), transparent 60%)',
        backgroundBlendMode: 'normal, screen',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '32px',
        alignItems: 'center',
      }}
    >
      {/* Status strip across full width */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 28,
          right: 28,
          height: 3,
          background: accent,
          borderRadius: '0 0 2px 2px',
        }}
      />

      {/* Left: prompt */}
      <div className="min-w-0 flex flex-col gap-3">
        <span
          className="inline-flex items-center self-start text-[10px] font-bold uppercase px-2 py-0.5"
          style={{
            background: `oklch(from ${accent} l c h / 0.18)`,
            color: accent,
            borderRadius: 'var(--r-pill)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.12em',
          }}
        >
          Featured Spark
        </span>
        <p
          className="text-[28px] italic line-clamp-3"
          style={{
            fontFamily: 'var(--font-prose)',
            color: 'var(--canvas-dark-ink-strong)',
            lineHeight: 1.3,
            fontWeight: 500,
          }}
        >
          <span
            aria-hidden
            style={{
              color: 'var(--brand)',
              fontWeight: 700,
              fontSize: '32px',
              marginRight: '4px',
            }}
          >
            “
          </span>
          {spark.title}
        </p>
        <p
          className="text-[12px]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          by @{spark.creatorUsername ?? 'unknown'}
        </p>
      </div>

      {/* Right: action column */}
      <div className="flex flex-col items-end gap-3 shrink-0">
        <span
          className="inline-flex items-center text-[10px] font-bold uppercase px-3 py-1"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-pill)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.12em',
          }}
        >
          Closing soon
        </span>
        {countdownLabel ? (
          <span
            className="text-[32px] leading-none"
            style={{
              color: 'var(--brand)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
            }}
          >
            {countdownLabel}
          </span>
        ) : null}
        <span
          className="text-[11px]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {spark.entryCount} {spark.entryCount === 1 ? 'entry' : 'entries'}{' '}
          so far
        </span>
        <Link
          href={`/${locale}/sparks/${spark.id}`}
          className="inline-flex items-center gap-2 h-9 px-5 text-[13px] font-semibold whitespace-nowrap transition-colors"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-pill)',
            fontFamily: 'var(--font-display)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--brand-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--brand)'
          }}
        >
          Enter the Spark
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
