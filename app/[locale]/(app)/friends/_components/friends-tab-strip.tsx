'use client'

import Link from 'next/link'

export type FriendsTab = 'friends' | 'pending' | 'suggested'

type Props = {
  locale: string
  activeTab: FriendsTab
  friendsCount: number
  pendingCount: number
  suggestedCount?: number | null
}

const TABS: { id: FriendsTab; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'pending', label: 'Pending' },
  { id: 'suggested', label: 'Suggested' },
]

export function FriendsTabStrip({
  locale,
  activeTab,
  friendsCount,
  pendingCount,
  suggestedCount = null,
}: Props) {
  const counts: Record<FriendsTab, number | null> = {
    friends: friendsCount,
    pending: pendingCount,
    suggested: suggestedCount,
  }

  return (
    <div className="tabwrap" style={{ marginBottom: 20 }}>
      <div className="tabstrip" role="tablist">
        {TABS.map((t) => {
          const isActive = activeTab === t.id
          const count = counts[t.id]
          return (
            <Link
              key={t.id}
              href={`/${locale}/friends?tab=${t.id}`}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={`tab${isActive ? ' active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              {t.label}
              {count !== null && <span className="ct">{count}</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
