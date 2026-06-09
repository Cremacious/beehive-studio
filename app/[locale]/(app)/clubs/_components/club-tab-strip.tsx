import Link from 'next/link'

// Q3 IA reorder: About / Books / Discussions / Members / Schedule
// (Books promoted from 3rd → 2nd).
const TABS = ['about', 'books', 'discussions', 'members', 'schedule'] as const

type Props = {
  clubId: string
  activeTab: string
  isModOrOwner: boolean
  locale: string
}

export function ClubTabStrip({ clubId, activeTab, isModOrOwner, locale }: Props) {
  return (
    <nav className="tabstrip flex items-center gap-4 border-b border-[var(--br-card)] pb-2">
      {TABS.map((tab) => (
        <Link
          key={tab}
          href={`/${locale}/clubs/${clubId}?tab=${tab}`}
          className={`text-sm capitalize ${
            activeTab === tab
              ? 'text-[var(--brand)] font-semibold'
              : 'text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]'
          }`}
        >
          {tab}
        </Link>
      ))}
      {isModOrOwner && (
        <Link
          href={`/${locale}/clubs/${clubId}?tab=settings`}
          className={`text-sm ${
            activeTab === 'settings'
              ? 'text-[var(--brand)] font-semibold'
              : 'text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]'
          }`}
        >
          Settings
        </Link>
      )}
    </nav>
  )
}
