import Link from 'next/link'

export type SparksTab = 'all' | 'yours' | 'following' | 'friends' | 'entered'

type TabEntry = { id: SparksTab; label: string }

const TABS: TabEntry[] = [
  { id: 'all', label: 'All' },
  { id: 'yours', label: 'Yours' },
  { id: 'following', label: 'Following' },
  { id: 'friends', label: 'Friends' },
  { id: 'entered', label: 'Entered' },
]

type Props = {
  locale: string
  current: SparksTab
  counts: {
    all: number
    yours: number
    following: number
    friends: number
    entered: number
  }
  /** Other URL params to preserve on each tab link (no `tab`, no `page`). */
  baseParams: Record<string, string | string[] | undefined>
}

/**
 * iOS segmented control for the /sparks hub. Renders 5 tab pills
 * (All / Yours / Following / Friends / Entered). Active tab is a
 * brand-yellow rounded pill; inactive tabs are bare label + count
 * with a subtle hover tint.
 *
 * Each tab link sets `?tab=X` explicitly — we never collapse a tab to
 * "default = no param". If we did, clicking a non-default tab while the
 * page was resolving to the default would generate an ambiguous URL.
 * Always honor the user's click. (See discover's DiscoveryModeToggle
 * `fa66b0c` precedent.)
 *
 * Tab switches reset `?page=1` (page param dropped from baseParams).
 * Other params (e.g. `sort`) are preserved.
 */
export function SparksTabStrip({ locale, current, counts, baseParams }: Props) {
  const hrefFor = (id: SparksTab): string => {
    const sp = new URLSearchParams()
    sp.set('tab', id)
    for (const [key, value] of Object.entries(baseParams)) {
      if (key === 'tab' || key === 'page') continue
      if (value === undefined) continue
      if (Array.isArray(value)) {
        if (value.length === 0) continue
        sp.set(key, value.join(','))
      } else {
        if (value === '') continue
        sp.set(key, value)
      }
    }
    return `/${locale}/sparks?${sp.toString()}`
  }

  return (
    <nav
      className="inline-flex items-center gap-0.5 p-1 self-start"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
      }}
      aria-label="Sparks tabs"
    >
      {TABS.map((t) => {
        const count = counts[t.id]
        const isActive = t.id === current
        if (isActive) {
          return (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-bold rounded-lg"
              style={{
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
              }}
              aria-current="page"
            >
              <span>{t.label}</span>
              {count > 0 && (
                <span
                  className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-4 text-[10px] font-bold rounded-full"
                  style={{ background: 'rgba(0,0,0,0.18)', color: 'var(--brand-ink)' }}
                >
                  {count}
                </span>
              )}
            </span>
          )
        }
        return (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] text-[var(--canvas-dark-ink)] hover:text-[var(--brand)] transition-colors rounded-lg"
          >
            <span>{t.label}</span>
            {count > 0 && (
              <span
                className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-4 text-[10px] font-medium rounded-full"
                style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--canvas-dark-ink)' }}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
