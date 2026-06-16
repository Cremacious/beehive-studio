import Link from 'next/link'
import { getSuggestedWritersAction } from '@/lib/actions/community.actions'
import {
  getViewerListStatsAction,
  getTrendingListsForRailAction,
} from '@/lib/actions/reading-lists-hub.actions'
import { FollowCuratorButton } from './follow-curator-button'

type Props = { locale: string; viewerId: string }

export async function ListsRightRail({ locale, viewerId }: Props) {
  const [statsR, trendingR, writersR] = await Promise.all([
    getViewerListStatsAction({ viewerId }),
    getTrendingListsForRailAction({ limit: 4 }),
    getSuggestedWritersAction({ limit: 2 }).catch(() => null),
  ])

  const stats = statsR.success
    ? statsR.data
    : { created: 0, following: 0, followers: 0, booksSaved: 0 }
  const trending = trendingR.success ? trendingR.data : []
  const writers = writersR?.success ? writersR.data : []

  return (
    <aside
      className="hidden xl:flex flex-col gap-4"
      style={{ position: 'sticky', top: 80, width: 300, alignSelf: 'start' }}
      aria-label="Reading lists suggestions"
    >
      <RailPanel title="Your list stats">
        <div className="grid grid-cols-2 gap-2 pt-1">
          <StatTile value={stats.created} label="Created" emphasize />
          <StatTile value={stats.following} label="Following" />
          <StatTile value={stats.followers} label="Followers" />
          <StatTile value={stats.booksSaved} label="Books saved" />
        </div>
      </RailPanel>

      <RailPanel
        title="Trending lists"
        seeAllHref={`/${locale}/discover?tab=lists`}
        seeAllLabel="Discover →"
      >
        {trending.length === 0 ? (
          <p
            className="text-[12px] py-1"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Nothing trending right now.
          </p>
        ) : (
          trending.map((t, i) => (
            <Link
              key={t.id}
              href={`/${locale}/reading-lists/${t.id}`}
              className="flex items-center gap-2.5 py-2.5"
              style={{
                borderTop:
                  i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <MiniCoverStack
                previews={t.coverPreviews}
                fallbackSeed={t.id}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12px] font-semibold leading-tight mb-0.5 truncate"
                  style={{
                    color: 'var(--canvas-dark-ink-strong)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {t.title}
                </div>
                <div
                  className="text-[10px] uppercase tracking-[0.05em] truncate"
                  style={{
                    color: 'var(--canvas-dark-ink-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {t.curator.username ? `@${t.curator.username}` : '@unknown'}
                  {' · '}
                  {t.newFollowersThisWeek} new
                </div>
              </div>
            </Link>
          ))
        )}
      </RailPanel>

      {writers.length > 0 ? (
        <RailPanel title="Suggested curators">
          {writers.slice(0, 2).map((w, i) => (
            <div
              key={w.id}
              className="flex items-center gap-2.5 py-2.5"
              style={{
                borderTop:
                  i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <Link
                href={`/${locale}/u/${w.username}`}
                className="shrink-0"
                aria-label={`Open @${w.username} profile`}
              >
                {w.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.image}
                    alt=""
                    className="rounded-full object-cover"
                    style={{ width: 32, height: 32 }}
                  />
                ) : (
                  <span
                    className="rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{
                      width: 32,
                      height: 32,
                      background: 'rgba(255,195,0,0.12)',
                      border: '1px solid rgba(255,195,0,0.3)',
                      color: 'var(--brand)',
                      fontFamily: 'var(--font-display)',
                    }}
                    aria-hidden="true"
                  >
                    {w.username?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/${locale}/u/${w.username}`}
                  className="block text-[12px] font-semibold leading-tight truncate"
                  style={{
                    color: 'var(--canvas-dark-ink-strong)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  @{w.username}
                </Link>
                {w.bookCount > 0 ? (
                  <div
                    className="text-[10px] uppercase tracking-[0.05em] truncate"
                    style={{
                      color: 'var(--canvas-dark-ink-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {w.bookCount} {w.bookCount === 1 ? 'book' : 'books'}
                  </div>
                ) : null}
              </div>
              <FollowCuratorButton userId={w.id} />
            </div>
          ))}
        </RailPanel>
      ) : null}
    </aside>
  )
}

function RailPanel({
  title,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  title: string
  seeAllHref?: string
  seeAllLabel?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--panel-bg)',
        border: 'var(--br-card)',
        borderRadius: 'var(--r-card)',
        padding: 18,
        boxShadow: 'var(--sh-card)',
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <h2
          className="text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-mono)' }}
        >
          {title}
        </h2>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="text-[10px]"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {seeAllLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function StatTile({
  value,
  label,
  emphasize,
}: {
  value: number | string
  label: string
  emphasize?: boolean
}) {
  // Created tile uses FLAT brand-tinted bg (locked from Chris's mockup review).
  // The other 3 tiles keep the standard --tile-bg vertical gradient.
  return (
    <div
      style={{
        background: emphasize ? 'rgba(255, 195, 0, 0.10)' : 'var(--tile-bg)',
        border: emphasize
          ? '1px solid rgba(255, 195, 0, 0.22)'
          : 'var(--br-card)',
        borderRadius: 'var(--r-btn)',
        padding: 12,
        boxShadow: emphasize ? 'none' : 'var(--sh-tile)',
      }}
    >
      <div
        className="text-[20px] font-bold leading-none"
        style={{
          color: emphasize ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {value}
      </div>
      <div
        className="text-[10px] uppercase tracking-[0.1em] mt-1.5 font-semibold"
        style={{
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function MiniCoverStack({
  previews,
  fallbackSeed,
}: {
  previews: Array<{ coverUrl: string | null }>
  fallbackSeed: string
}) {
  // 22×28 covers, rotated -6°/0°/+6°, -8px overlap via absolute positioning.
  const slots: Array<{ coverUrl: string | null }> =
    previews.length >= 3
      ? previews.slice(0, 3)
      : [...previews, ...Array(3 - previews.length).fill({ coverUrl: null })]

  const layout = [
    { left: 0, rotate: -6, z: 1 },
    { left: 8, rotate: 0, z: 2 },
    { left: 16, rotate: 6, z: 1 },
  ]

  return (
    <div
      className="relative shrink-0"
      style={{ width: 38, height: 28 }}
      aria-hidden="true"
    >
      {slots.map((s, idx) => {
        const l = layout[idx]!
        return (
          <span
            key={`${fallbackSeed}-${idx}`}
            className="absolute"
            style={{
              left: l.left,
              top: 0,
              width: 22,
              height: 28,
              borderRadius: 3,
              transform: `rotate(${l.rotate}deg)`,
              zIndex: l.z,
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
              background: s.coverUrl
                ? `url("${s.coverUrl}") center/cover no-repeat`
                : 'linear-gradient(135deg, var(--canvas-dark-350), var(--canvas-dark-250))',
            }}
          />
        )
      })}
    </div>
  )
}
