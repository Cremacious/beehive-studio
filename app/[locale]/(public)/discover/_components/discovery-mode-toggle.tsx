import Link from 'next/link'
import { Sparkles, Flame, Star, Library } from 'lucide-react'
import { buildUrl, type TabId, type ModeId } from '@/lib/discover/url-state'

type ModeEntry = {
  id: ModeId
  label: string
  Icon: typeof Sparkles
}

const ALL_MODES: ModeEntry[] = [
  { id: 'for-you', label: 'For You', Icon: Sparkles },
  { id: 'trending', label: 'Trending', Icon: Flame },
  { id: 'popular', label: 'Popular', Icon: Star },
  { id: 'all', label: 'All', Icon: Library },
]

type Props = {
  tab: TabId
  locale: string
  current: ModeId
  isAuthed: boolean
  /** Other URL params to preserve on each mode link (no `mode`, no `page`). */
  baseParams: Record<string, string | string[] | undefined>
}

/**
 * iOS segmented control for /discover discovery mode. Renders 4 buttons
 * for authed viewers (For You / Trending / Popular / All), 3 for guests
 * (no For You). Active mode is a brand-yellow rounded pill; inactive
 * modes are bare label + icon with a subtle hover tint.
 *
 * Each mode link is a server-rendered <Link> with `?mode=X` preserved
 * across other filter params. The 'trending' mode is the default for
 * guests + zero-signal authed users, so when 'trending' is selected
 * we drop the `?mode=` param entirely.
 *
 * Mode switches reset `?page=1` (page param dropped from baseParams).
 */
export function DiscoveryModeToggle({
  tab,
  locale,
  current,
  isAuthed,
  baseParams,
}: Props) {
  const modes = isAuthed ? ALL_MODES : ALL_MODES.filter((m) => m.id !== 'for-you')

  const hrefFor = (modeId: ModeId): string => {
    const params: Record<string, string | string[] | undefined> = { ...baseParams }
    // page resets on mode switch
    delete params.page
    // Default mode (trending) omits the URL param.
    if (modeId === 'trending') {
      delete params.mode
    } else {
      params.mode = modeId
    }
    return buildUrl(tab, params, `/${locale}/discover`)
  }

  return (
    <nav
      className="inline-flex items-center gap-0.5 rounded-xl p-1 self-start"
      style={{ background: 'rgba(255, 255, 255, 0.04)' }}
      aria-label="Discovery mode"
    >
      {modes.map((m) => {
        const isActive = m.id === current
        if (isActive) {
          return (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-bold rounded-lg"
              style={{
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
              }}
              aria-current="page"
            >
              <m.Icon size={13} aria-hidden="true" />
              {m.label}
            </span>
          )
        }
        return (
          <Link
            key={m.id}
            href={hrefFor(m.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] text-[var(--canvas-dark-ink)] hover:text-[var(--brand)] transition-colors rounded-lg"
          >
            <m.Icon size={13} aria-hidden="true" />
            {m.label}
          </Link>
        )
      })}
    </nav>
  )
}
