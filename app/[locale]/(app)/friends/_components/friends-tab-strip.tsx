'use client'

import Link from 'next/link'

export type FriendsTab = 'friends' | 'requests' | 'sent' | 'suggested'

type Props = {
  locale: string
  activeTab: FriendsTab
  friendsCount: number
  requestsCount: number
  sentCount: number
}

const TABS: { id: FriendsTab; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'sent', label: 'Sent' },
  { id: 'suggested', label: 'Suggested' },
]

export function FriendsTabStrip({
  locale,
  activeTab,
  friendsCount,
  requestsCount,
  sentCount,
}: Props) {
  const counts: Record<FriendsTab, number | null> = {
    friends: friendsCount,
    requests: requestsCount,
    sent: sentCount,
    suggested: null,
  }

  return (
    <nav
      aria-label="Friends sections"
      className="flex gap-1 border-b mb-6"
      style={{ borderColor: 'var(--br-card)' }}
    >
      {TABS.map((t) => {
        const isActive = activeTab === t.id
        const count = counts[t.id]
        const showBadge = t.id === 'requests' && (count ?? 0) > 0
        return (
          <Link
            key={t.id}
            href={`/${locale}/friends?tab=${t.id}`}
            aria-current={isActive ? 'page' : undefined}
            className="relative px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors"
            style={{
              color: isActive
                ? 'var(--brand)'
                : 'var(--canvas-dark-ink-muted)',
              borderBottomColor: isActive ? 'var(--brand)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            {t.label}
            {count !== null && (
              <span
                className="ml-1.5 text-[11px]"
                style={{
                  color: isActive
                    ? 'var(--brand)'
                    : 'var(--canvas-dark-ink-muted)',
                }}
              >
                {count}
              </span>
            )}
            {showBadge && (
              <span
                aria-label={`${count} new`}
                className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold align-middle"
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
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
