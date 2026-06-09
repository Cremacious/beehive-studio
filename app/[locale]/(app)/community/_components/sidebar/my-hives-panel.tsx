import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'
import type { UserHiveView } from '@/lib/actions/hive.actions'

const AVATAR_TONES = ['blue', 'mint', 'lilac', 'coral', 'slate'] as const
function pickTone(seed: string): (typeof AVATAR_TONES)[number] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
}

const ROLE_LABEL: Record<UserHiveView['viewerRole'], string> = {
  OWNER: 'Owner',
  MODERATOR: 'Mod',
  CONTRIBUTOR: 'Contributor',
  BETA_READER: 'Reader',
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
      <section className="panel rail-card" aria-label="My Hives">
        <div className="sec-head" style={{ margin: '14px 18px 4px' }}>
          <h2 style={{ fontSize: 15 }}>My Hives</h2>
        </div>
        <p
          style={{
            margin: '0 18px 12px',
            fontSize: 12,
            color: 'rgb(255 255 255 / 0.9)',
          }}
        >
          Join or create a Hive to write together.
        </p>
        <Link
          className="see-all"
          href={`/${locale}/discover?tab=hives`}
          style={{ margin: '0 18px 14px' }}
        >
          Browse Hives
          <ArrowRight />
        </Link>
      </section>
    )
  }

  return (
    <section className="panel rail-card" aria-label="My Hives">
      <div className="sec-head" style={{ margin: '14px 18px 4px' }}>
        <h2 style={{ fontSize: 15 }}>My Hives</h2>
        <span className="count">{hives.length}</span>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visible.map((h) => {
          const initial = h.name[0]?.toUpperCase() ?? '?'
          const tone = pickTone(h.id)
          return (
            <li key={h.id} className="rail-row">
              <Link
                href={`/${locale}/hive/${h.id}`}
                className="top"
                style={{ textDecoration: 'none' }}
              >
                <span
                  className={`avatar a-${tone}`}
                  style={{ width: 40, height: 40, fontSize: 15 }}
                >
                  {initial}
                </span>
                <div>
                  <p className="name">{h.name}</p>
                  <p className="sub">
                    <Users size={12} />
                    {h.memberCount} {h.memberCount === 1 ? 'member' : 'members'}
                    {' · '}
                    {ROLE_LABEL[h.viewerRole]}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {hasMore ? (
        <Link
          className="see-all"
          href={`/${locale}/hives`}
          style={{ margin: '4px 18px 14px' }}
        >
          See all {hives.length} hives
          <ArrowRight />
        </Link>
      ) : null}
    </section>
  )
}
