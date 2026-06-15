import Link from 'next/link'
import { getSuggestedWritersAction } from '@/lib/actions/community.actions'
import {
  getTrendingSparksForRailAction,
  getViewerSparkStatsAction,
} from '@/lib/actions/sparks-rail.actions'

type Props = { locale: string }

export async function SparksRightRail({ locale }: Props) {
  const [writersR, trendingR, statsR] = await Promise.all([
    getSuggestedWritersAction({ limit: 4 }).catch(() => null),
    getTrendingSparksForRailAction({ limit: 3 }),
    getViewerSparkStatsAction(),
  ])

  const writers = writersR?.success ? writersR.data : []
  const trending = trendingR.success ? trendingR.data : []
  const stats = statsR.success
    ? statsR.data
    : { created: 0, entered: 0, entriesReceived: 0, wins: 0 }

  return (
    <aside
      className="hidden xl:flex flex-col gap-4"
      style={{ position: 'sticky', top: 80, width: 300, alignSelf: 'start' }}
      aria-label="Sparks suggestions"
    >
      {writers.length > 0 ? (
        <RailPanel
          title="Suggested writers"
          seeAllHref={`/${locale}/discover?tab=sparks`}
          seeAllLabel="See all →"
        >
          {writers.map((w, i) => (
            <div
              key={w.id}
              className="flex items-center gap-2.5 py-2"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                className="rounded-full shrink-0"
                style={{ width: 32, height: 32, background: 'oklch(0.45 0.05 256)' }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-bold truncate"
                  style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
                >
                  {w.username}
                </div>
                <div
                  className="text-[11px] truncate"
                  style={{ color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  @{w.username}
                </div>
              </div>
              <Link
                href={`/${locale}/u/${w.username}`}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                style={{
                  background: i === 0 ? 'var(--brand)' : 'rgba(255,255,255,0.06)',
                  color: i === 0 ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-strong)',
                  border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                View
              </Link>
            </div>
          ))}
        </RailPanel>
      ) : null}

      <RailPanel
        title="Trending now"
        seeAllHref={`/${locale}/discover?tab=sparks`}
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
          trending.map((s, i) => (
            <Link
              key={s.id}
              href={`/${locale}/discover/spark/${s.id}`}
              className="block py-2"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                className="text-[12px] font-bold leading-snug mb-1"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                {s.title}
              </div>
              <div
                className="text-[10px] uppercase tracking-[0.06em]"
                style={{ color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {s.status === 'VOTING' ? '🗳️ VOTING' : '⚡ OPEN'} · {s.entryCount} entries
                {s.deadline ? ` · ${formatLeft(s.deadline)}` : ''}
              </div>
            </Link>
          ))
        )}
      </RailPanel>

      <RailPanel title="Your spark stats">
        <div className="grid grid-cols-2 gap-3 pt-1">
          <StatTile value={stats.created} label="Created" emphasize />
          <StatTile value={stats.entered} label="Entered" />
          <StatTile value={stats.entriesReceived} label="Entries received" />
          <StatTile value={stats.wins} label="Wins" />
        </div>
      </RailPanel>
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
      className="rounded-2xl p-4"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <h2
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
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

function StatTile({ value, label, emphasize }: { value: number; label: string; emphasize?: boolean }) {
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
        style={{ color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </div>
    </div>
  )
}

function formatLeft(deadline: Date | string): string {
  const d = deadline instanceof Date ? deadline : new Date(deadline)
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return 'ended'
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days}d left`
  const hrs = Math.floor(ms / 3_600_000)
  return `${hrs}h left`
}
