'use client'
import { useRouter, usePathname } from 'next/navigation'

type Tab = 'books' | 'sparks' | 'hives' | 'lists' | 'clubs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'books', label: 'Books' },
  { id: 'sparks', label: 'Sparks' },
  { id: 'hives', label: 'Hives' },
  { id: 'lists', label: 'Lists' },
  { id: 'clubs', label: 'Clubs' },
]

export function DiscoverTabs({ currentTab }: { currentTab: Tab }) {
  const router = useRouter()
  const pathname = usePathname()
  // Extract locale from pathname (first segment after leading slash)
  const locale = pathname.split('/')[1]

  return (
    <nav className="tabstrip" role="tablist" aria-label="Discover sections">
      {TABS.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={currentTab === tab.id}
          onClick={() => router.push(`/${locale}/discover?tab=${tab.id}`)}
          className={`tab ${currentTab === tab.id ? 'active' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
