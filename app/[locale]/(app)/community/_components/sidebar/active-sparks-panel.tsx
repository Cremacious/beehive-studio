import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ActiveSparkEntry } from '@/lib/types/community'

const STATUS_LABEL: Record<ActiveSparkEntry['status'], string> = {
  submitted: 'Submitted',
  voting: 'Voting',
  awaiting_winner: 'Awaiting winner',
  won: 'Won',
}

// Bundle pill tones — map our status union to bundle's spark-{state} pill class.
// Bundle defines .pill.spark-open / .spark-voting / .spark-closed; we map
// submitted → open, voting → voting, awaiting_winner → closed, won → voting
// (won has its own brand-soft styling at the .pill level if available).
const STATUS_PILL: Record<ActiveSparkEntry['status'], string> = {
  submitted: 'spark-open',
  voting: 'spark-voting',
  awaiting_winner: 'spark-closed',
  won: 'spark-voting',
}

export function ActiveSparksPanel({
  locale,
  entries,
}: {
  locale: string
  entries: ActiveSparkEntry[]
}) {
  const visible = entries.slice(0, 5)
  const hasMore = entries.length > 5

  if (entries.length === 0) {
    return (
      <section className="panel rail-card panel-pad" aria-label="Your sparks">
        <div className="sec-head" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 15 }}>Your Sparks</h2>
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--canvas-dark-ink-muted)',
            marginBottom: 10,
          }}
        >
          No sparks yet — try one and get the page glowing.
        </p>
        <Link className="see-all" href={`/${locale}/sparks`}>
          Try a Spark
          <ArrowRight />
        </Link>
      </section>
    )
  }

  return (
    <section className="panel rail-card panel-pad" aria-label="Your sparks">
      <div className="sec-head" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 15 }}>Your Sparks</h2>
        <span className="count">{entries.length}</span>
      </div>

      {visible.map((e) => (
        <Link
          key={e.entryId}
          href={`/${locale}/sparks/${e.sparkId}`}
          className="mini-row"
          style={{ textDecoration: 'none' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mr-t" style={{ fontSize: 12.5 }}>
              {e.sparkPrompt}
            </div>
            <span
              className={`pill ${STATUS_PILL[e.status]}`}
              style={{ marginTop: 6 }}
            >
              <span className="dot" />
              {STATUS_LABEL[e.status]}
            </span>
          </div>
        </Link>
      ))}

      {hasMore ? (
        <Link className="see-all" href={`/${locale}/sparks`}>
          See all {entries.length} sparks
          <ArrowRight />
        </Link>
      ) : null}
    </section>
  )
}
