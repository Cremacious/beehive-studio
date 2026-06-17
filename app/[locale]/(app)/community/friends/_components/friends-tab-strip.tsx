import Link from 'next/link'

export type FriendsTab = 'friends' | 'pending' | 'find'

type Props = {
  locale: string
  activeTab: FriendsTab
  friendsCount: number
  pendingCount: number
}

const TABS: { id: FriendsTab; label: string; hideCount?: boolean }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'pending', label: 'Pending' },
  { id: 'find', label: 'Find', hideCount: true },
]

/**
 * iOS segmented control for /friends. Mirrors SparksTabStrip shape —
 * inline pill row with `Label · N` per tab, brand-yellow active pill.
 * Suggested-friends moves out of the tab strip into the right rail.
 */
export function FriendsTabStrip({
  locale,
  activeTab,
  friendsCount,
  pendingCount,
}: Props) {
  const counts: Record<FriendsTab, number | null> = {
    friends: friendsCount,
    pending: pendingCount,
    find: null,
  }

  return (
    <nav
      className="inline-flex items-center gap-0.5 p-1 self-start"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
      }}
      aria-label="Friends tabs"
    >
      {TABS.map((t) => {
        const isActive = activeTab === t.id
        const count = counts[t.id]
        const showCount = !t.hideCount && count !== null && count > 0
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
              {showCount ? (
                <span
                  className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-4 text-[10px] font-bold rounded-full"
                  style={{ background: 'rgba(0,0,0,0.18)', color: 'var(--brand-ink)' }}
                >
                  {count}
                </span>
              ) : null}
            </span>
          )
        }
        return (
          <Link
            key={t.id}
            href={`/${locale}/community/friends?tab=${t.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] text-[var(--canvas-dark-ink)] hover:text-[var(--brand)] transition-colors rounded-lg"
          >
            <span>{t.label}</span>
            {showCount ? (
              <span
                className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-4 text-[10px] font-medium rounded-full"
                style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--canvas-dark-ink)' }}
              >
                {count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
