import type { CSSProperties } from 'react'
import Link from 'next/link'
import {
  getViewerClubStatsAction,
  getTrendingClubsForRailAction,
} from '@/lib/actions/clubs-rail.actions'

type Props = { locale: string }

export async function ClubsRightRail({ locale }: Props) {
  const [statsR, trendingR] = await Promise.all([
    getViewerClubStatsAction(),
    getTrendingClubsForRailAction({ limit: 12 }),
  ])

  const stats = statsR.success
    ? statsR.data
    : { owned: 0, memberOf: 0, booksFinished: 0, currentlyReading: 0 }
  const trending = trendingR.success ? trendingR.data : []

  return (
    <aside
      className="hidden xl:flex flex-col gap-4"
      style={{
        position: 'sticky',
        top: 80,
        width: 300,
        height: 'calc(100vh - 100px)',
        alignSelf: 'start',
      }}
      aria-label="Clubs suggestions"
    >
      <RailPanel title="Your club stats">
        <div className="grid grid-cols-2 gap-3 pt-1">
          <StatTile value={stats.owned} label="Owned" emphasize />
          <StatTile value={stats.memberOf} label="Member of" />
          <StatTile value={stats.booksFinished} label="Books finished" />
          <StatTile value={stats.currentlyReading} label="Currently reading" />
        </div>
      </RailPanel>

      <RailPanel
        title="Trending clubs"
        seeAllHref={`/${locale}/discover?tab=clubs`}
        seeAllLabel="Discover →"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
          padding: 0,
        }}
        headerStyle={{ padding: '16px 16px 0 16px', marginBottom: 12 }}
        bodyStyle={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: '0 16px 16px 16px',
        }}
      >
        {trending.length === 0 ? (
          <p
            className="text-[12px] py-1"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Nothing trending right now.
          </p>
        ) : (
          trending.map((c, i) => {
            const metaSuffix = c.currentBookTitle
              ? ` · NOW READING ${c.currentBookTitle}`
              : c.openJoin
                ? ' · OPEN'
                : ''
            return (
              <Link
                key={c.id}
                href={`/${locale}/clubs/${c.id}`}
                className="flex items-start gap-2 py-2"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <ClubThumb name={c.name} coverImageUrl={c.coverImageUrl} />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12px] font-bold leading-snug mb-1 truncate"
                    style={{ color: 'var(--canvas-dark-ink-strong)' }}
                  >
                    {c.name}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.06em] truncate"
                    style={{
                      color: 'var(--canvas-dark-ink-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {c.memberCount} {c.memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
                    {metaSuffix}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </RailPanel>
    </aside>
  )
}

function ClubThumb({
  name,
  coverImageUrl,
}: {
  name: string
  coverImageUrl: string | null
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  if (coverImageUrl) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: 6,
          backgroundImage: `url(${coverImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className="inline-flex items-center justify-center text-[12px] font-bold"
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: '999px',
        background:
          'linear-gradient(135deg, var(--canvas-dark-300), var(--canvas-dark-200))',
        color: 'var(--brand)',
        fontFamily: 'var(--font-display)',
      }}
    >
      {initial}
    </div>
  )
}

function RailPanel({
  title,
  seeAllHref,
  seeAllLabel,
  children,
  style,
  headerStyle,
  bodyStyle,
}: {
  title: string
  seeAllHref?: string
  seeAllLabel?: string
  children: React.ReactNode
  style?: CSSProperties
  headerStyle?: CSSProperties
  bodyStyle?: CSSProperties
}) {
  return (
    <div
      className="rounded-2xl"
      style={{
        padding: 16,
        background:
          'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
        boxShadow:
          '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
        ...style,
      }}
    >
      <div
        className="flex justify-between items-center mb-3"
        style={headerStyle}
      >
        <h2
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{
            color: 'var(--brand)',
            fontFamily: 'var(--font-display)',
          }}
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
      {bodyStyle ? <div style={bodyStyle}>{children}</div> : children}
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
  return (
    <div>
      <div
        className="text-[22px] font-bold leading-none"
        style={{
          color: emphasize ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {value}
      </div>
      <div
        className="text-[10px] uppercase tracking-[0.08em] mt-1.5"
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
