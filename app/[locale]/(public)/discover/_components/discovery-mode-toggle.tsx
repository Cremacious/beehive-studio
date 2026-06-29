import Link from 'next/link'
import { Sparkles, Flame, Star, Library } from 'lucide-react'
import { buildUrl, type TabId, type ModeId } from '@/lib/discover/url-state'

type ModeEntry = {
  id: ModeId
  label: string
  Icon: typeof Sparkles
}

const ALL_MODES: ModeEntry[] = [
  { id: 'all', label: 'All', Icon: Library },
  { id: 'for-you', label: 'For You', Icon: Sparkles },
  { id: 'trending', label: 'Trending', Icon: Flame },
  { id: 'popular', label: 'Popular', Icon: Star },
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
 * for authed viewers (All / For You / Trending / Popular), 3 for guests
 * (no For You). Active mode is a brand-yellow rounded pill; inactive
 * modes are bare label + icon with a subtle hover tint.
 *
 * Each mode link is a server-rendered <Link> with an explicit `?mode=X`
 * param. We do NOT collapse to "default mode = no param" on the toggle —
 * if we did, clicking Trending while an authed user was in default-For-You
 * mode would generate a no-mode URL that the server then resolves back to
 * For You, making the Trending button a no-op for that user. Always set
 * the mode explicitly so the user's click is honored.
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
    // Always set the mode explicitly — see jsdoc above.
    params.mode = modeId
    return buildUrl(tab, params, `/${locale}/discover`)
  }

  return (
    <nav
      className="grid grid-cols-2 gap-1 w-full rounded-xl p-1 md:inline-flex md:w-auto md:items-center md:gap-0.5 md:self-start"
      style={{ background: 'rgba(255, 255, 255, 0.04)' }}
      aria-label="Discovery mode"
    >
      {modes.map((m) => {
        const isActive = m.id === current
        if (isActive) {
          return (
            <span
              key={m.id}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-[12px] font-bold rounded-lg max-md:w-full"
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
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-[12px] text-[var(--canvas-dark-ink)] hover:text-[var(--brand)] transition-colors rounded-lg max-md:w-full"
          >
            <m.Icon size={13} aria-hidden="true" />
            {m.label}
          </Link>
        )
      })}
    </nav>
  )
}
