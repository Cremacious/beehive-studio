import Link from 'next/link'
import { Clock, Globe, Lock, MessageSquare, Heart, Users } from 'lucide-react'
import type { SparkSummary } from '@/lib/actions/sparks.actions'
import { StatusPill } from './status-pill'

function timeLeftLabel(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return ''
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  return days > 0 ? `${days}d` : `${hours}h`
}

const VIS_META = {
  PUBLIC: { label: 'Public', Icon: Globe, cls: 'vis-public' as const },
  FRIENDS: { label: 'Friends', Icon: Users, cls: 'vis-friends' as const },
  PRIVATE: { label: 'Private', Icon: Lock, cls: 'vis-private' as const },
}

function statusToken(status: 'OPEN' | 'VOTING' | 'CLOSED'): string {
  if (status === 'OPEN') return 'var(--spark-status-open)'
  if (status === 'VOTING') return 'var(--spark-status-voting)'
  return 'var(--spark-status-closed)'
}

export function SparkCard({ spark, locale }: { spark: SparkSummary; locale: string }) {
  const vis = VIS_META[spark.visibility]
  const VisIcon = vis.Icon
  const isClosed = spark.status === 'CLOSED'
  const deadlineLabel =
    spark.status === 'OPEN'
      ? timeLeftLabel(spark.deadline)
      : spark.status === 'VOTING' && spark.votingEndsAt
        ? timeLeftLabel(spark.votingEndsAt)
        : ''

  return (
    <Link
      href={`/${locale}/sparks/${spark.id}`}
      className="ccard"
      style={isClosed ? undefined : undefined}
    >
      <div
        className="cc-cover cover-grad"
        style={
          {
            ['--pt' as string]: statusToken(spark.status),
            ...(isClosed ? { height: '88px' } : {}),
          } as React.CSSProperties
        }
      >
        <div className="cc-pills">
          <StatusPill status={spark.status} />
          <span className={`pill ${vis.cls}`}>
            <VisIcon />
            {vis.label}
          </span>
        </div>
      </div>
      <div className="cc-body">
        <h3 className="cc-title">{spark.prompt}</h3>
        {spark.wordLimit ? (
          <p className="cc-desc">max {spark.wordLimit} words · by {spark.creatorDisplayName ?? spark.creatorUsername ?? 'Unknown'}</p>
        ) : (
          <p className="cc-desc">by {spark.creatorDisplayName ?? spark.creatorUsername ?? 'Unknown'}</p>
        )}
        <div className="cc-foot">
          {isClosed && spark.winnerUsername ? (
            <span className="meta">
              Won by{' '}
              <b style={{ color: 'var(--canvas-dark-ink)', fontFamily: 'var(--font-display)' }}>
                @{spark.winnerUsername}
              </b>
            </span>
          ) : deadlineLabel ? (
            <span className="deadline" style={{ padding: '4px 11px' }}>
              <Clock />
              {spark.status === 'VOTING' ? (
                <>
                  Voting ends in <b>{deadlineLabel}</b>
                </>
              ) : (
                <>
                  <b>{deadlineLabel}</b> left
                </>
              )}
            </span>
          ) : (
            <span />
          )}
          <div className="cc-stats">
            {isClosed ? (
              <span className="cc-stat">
                <Heart />
                {spark.entryCount}
              </span>
            ) : (
              <span className="cc-stat">
                <MessageSquare />
                {spark.entryCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
