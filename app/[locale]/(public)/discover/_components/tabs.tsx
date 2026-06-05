'use client'
import { useRouter, usePathname } from 'next/navigation'

type Tab = 'books' | 'sparks' | 'hives' | 'lists'

const TABS: { id: Tab; label: string }[] = [
  { id: 'books', label: 'Books' },
  { id: 'sparks', label: '⚡ Sparks' },
  { id: 'hives', label: 'Hives' },
  { id: 'lists', label: 'Lists' },
]

export function DiscoverTabs({ currentTab }: { currentTab: Tab }) {
  const router = useRouter()
  const pathname = usePathname()
  // Extract locale from pathname (first segment after leading slash)
  const locale = pathname.split('/')[1]

  return (
    <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 flex">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => router.push(`/${locale}/discover?tab=${tab.id}`)}
          className={`px-5 py-3 text-[13px] border-b-2 transition-colors cursor-pointer ${
            currentTab === tab.id
              ? 'text-[#FFC300] border-[#FFC300] font-semibold'
              : 'text-[#666] border-transparent hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
