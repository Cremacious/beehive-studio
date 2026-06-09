import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export type RequestsSample = {
  userId: string
  username: string | null
  avatarUrl: string | null
}

// Deterministic avatar tone picker matching the activity-event-row palette.
const AVATAR_TONES = ['blue', 'mint', 'lilac', 'coral', 'slate'] as const
function pickTone(seed: string): (typeof AVATAR_TONES)[number] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
}

export function RequestsCard({
  locale,
  count,
  samples,
}: {
  locale: string
  count: number
  samples: RequestsSample[]
}) {
  if (count === 0) return null

  // Show up to 5 samples inline per bundle spec; "See all" footer when > 5.
  const visible = samples.slice(0, 5)
  const hasMore = count > visible.length

  return (
    <section className="panel rail-card panel-pad" aria-label="Friend requests">
      <div className="sec-head" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15 }}>Requests</h2>
        <span className="count">{count}</span>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visible.map((s, i) => {
          const initial = (s.username ?? '?')[0]?.toUpperCase() ?? '?'
          const tone = pickTone(s.userId)
          const display = s.username ? `@${s.username}` : 'Someone'
          return (
            <li
              key={s.userId}
              className="req-item"
              style={i > 0 ? { marginTop: 14 } : undefined}
            >
              {s.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.avatarUrl}
                  alt=""
                  className={`avatar s32`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <span className={`avatar s32 a-${tone}`}>{initial}</span>
              )}
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--canvas-dark-ink-strong)',
                  }}
                >
                  {display}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <Link className="see-all" href={`/${locale}/friends?tab=pending&seg=received`}>
        {hasMore ? `See all ${count} requests` : 'Manage requests'}
        <ArrowRight />
      </Link>
    </section>
  )
}
