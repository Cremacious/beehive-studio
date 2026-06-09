import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'
import type { UserHiveView } from '@/lib/actions/hive.actions'

const AVATAR_TONES = ['blue', 'mint', 'lilac', 'coral', 'slate'] as const
function pickTone(seed: string): (typeof AVATAR_TONES)[number] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
}

export function MyHivesPanel({
  locale,
  hives,
}: {
  locale: string
  hives: UserHiveView[]
}) {
  const visible = hives.slice(0, 5)
  const hasMore = hives.length > 5

  if (hives.length === 0) {
    return (
      <section className="panel rail-card panel-pad" aria-label="My Hives">
        <div className="sec-head" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 15 }}>My Hives</h2>
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--canvas-dark-ink-muted)',
            marginBottom: 10,
          }}
        >
          Join or create a Hive to write together.
        </p>
        <Link className="see-all" href={`/${locale}/discover?tab=hives`}>
          Browse Hives
          <ArrowRight />
        </Link>
      </section>
    )
  }

  return (
    <section className="panel rail-card panel-pad" aria-label="My Hives">
      <div className="sec-head" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 15 }}>My Hives</h2>
        <span className="count">{hives.length}</span>
      </div>

      {visible.map((h) => {
        const initial = h.name[0]?.toUpperCase() ?? '?'
        const tone = pickTone(h.id)
        return (
          <Link
            key={h.id}
            href={`/${locale}/hive/${h.id}`}
            className="mini-row"
            style={{ textDecoration: 'none' }}
          >
            <span className={`avatar s24 a-${tone}`}>{initial}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mr-t">{h.name}</div>
              <div
                className="mr-s"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Users size={10} />
                {h.memberCount}
              </div>
            </div>
          </Link>
        )
      })}

      {hasMore ? (
        <Link className="see-all" href={`/${locale}/studio`}>
          See all {hives.length} hives
          <ArrowRight />
        </Link>
      ) : null}
    </section>
  )
}
