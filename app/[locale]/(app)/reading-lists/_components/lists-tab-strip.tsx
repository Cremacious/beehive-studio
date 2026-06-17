import Link from 'next/link'

export type ListsTab = 'all' | 'yours' | 'following' | 'liked'

type TabEntry = { id: ListsTab; label: string }

const TABS: TabEntry[] = [
  { id: 'all', label: 'All' },
  { id: 'yours', label: 'Yours' },
  { id: 'following', label: 'Following' },
  { id: 'liked', label: 'Liked' },
]

type Props = {
  activeTab: ListsTab
  counts: {
    all: number
    yours: number
    following: number
    liked: number
  }
  locale: string
  /** Current sort, threaded so tab clicks preserve it. */
  sort: string
}

/**
 * iOS segmented control for the /reading-lists hub. Renders 4 tab pills
 * (All / Yours / Following / Liked). Active tab is a brand-yellow rounded
 * pill; inactive tabs are bare label + count with a subtle hover tint.
 *
 * Each tab link sets `?tab=X` explicitly — we never collapse a tab to
 * "default = no param". Tab switches reset `?page=1` (page param dropped).
 * Sort param is preserved.
 *
 * URL construction is inline via URLSearchParams — the Hub URL contract is
 * distinct from Discover, so we don't reuse lib/discover/url-state.ts:buildUrl
 * (mirrors Sparks Hub W3 precedent).
 */
export function ListsTabStrip({ activeTab, counts, locale, sort }: Props) {
  const hrefFor = (id: ListsTab): string => {
    const sp = new URLSearchParams()
    sp.set('tab', id)
    if (sort && sort !== '') sp.set('sort', sort)
    return `/${locale}/reading-lists?${sp.toString()}`
  }

  return (
    <nav
      className="inline-flex items-center gap-0.5 p-1 self-start"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
      }}
      aria-label="Reading lists tabs"
    >
      {TABS.map((t) => {
        const count = counts[t.id]
        const isActive = t.id === activeTab
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
