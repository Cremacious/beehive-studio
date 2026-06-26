'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListOrdered,
  BookOpen,
  MessagesSquare,
  Send,
  Target,
  Megaphone,
  Users,
  Settings,
} from 'lucide-react'

type Props = {
  hiveId: string
  locale: string
  hiveName: string
  wordGoalPct?: number | null
}

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, segment: '' },
  { label: 'Outline', icon: ListOrdered, segment: '/outline' },
  { label: 'Chapters', icon: BookOpen, segment: '/chapters' },
  { label: 'Wiki', icon: BookOpen, segment: '/wiki' },
  { label: 'Discussions', icon: MessagesSquare, segment: '/discussions' },
  { label: 'Submit Chapter', icon: Send, segment: '/submissions' },
  { label: 'Word Goals', icon: Target, segment: '/word-goals' },
  { label: 'Buzz Board', icon: Megaphone, segment: '/buzz' },
  { label: 'Members', icon: Users, segment: '/members' },
  { label: 'Settings', icon: Settings, segment: '/settings' },
] as const

export function HiveSidebar({ hiveId, locale, hiveName, wordGoalPct }: Props) {
  const pathname = usePathname()
  const base = `/${locale}/hive/${hiveId}`

  function isActive(segment: string) {
    if (segment === '') return pathname === base
    return pathname.startsWith(base + segment)
  }

  return (
    <aside
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      className="w-[260px] shrink-0 flex flex-col overflow-hidden max-md:w-full max-md:shrink"
    >
      <div
        className="px-4 py-4 flex items-center justify-center max-md:hidden"
        style={{ borderBottom: 'var(--br-card)' }}
      >
        <h2
          style={{ color: 'var(--brand)' }}
          className="font-comfortaa font-bold text-base truncate text-center"
        >
          {hiveName}
        </h2>
      </div>
      <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto max-md:flex-row max-md:overflow-x-auto max-md:overflow-y-hidden scrollbar-hide">
        {NAV_ITEMS.map(({ label, icon: Icon, segment }) => {
          const active = isActive(segment)
          const showBadge =
            segment === '/word-goals' && wordGoalPct !== null && wordGoalPct !== undefined
          return (
            <Link
              key={segment}
              href={base + segment}
              style={{
                borderRadius: 'var(--r-row)',
                background: active
                  ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                  : undefined,
                boxShadow: active ? 'var(--sh-tile)' : undefined,
              }}
              className={
                active
                  ? 'flex flex-col gap-1 px-3 py-2 text-sm transition-colors max-md:shrink-0 max-md:whitespace-nowrap text-[var(--canvas-dark-ink-strong)]'
                  : 'flex flex-col gap-1 px-3 py-2 text-sm transition-colors max-md:shrink-0 max-md:whitespace-nowrap text-[var(--canvas-dark-ink)] hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]'
              }
            >
              <div className="flex items-center gap-2">
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{
                    color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                  }}
                />
                <span className="truncate">{label}</span>
              </div>
              {showBadge && (
                <div
                  className="ml-6 h-0.5 w-[calc(100%-1.5rem)] rounded-full overflow-hidden"
                  style={{ background: 'var(--canvas-dark-300)', opacity: 0.5 }}
                >
                  <div
                    className="h-full bg-brand transition-[width] duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, wordGoalPct ?? 0))}%`,
                    }}
                    aria-label={`Word Goal progress: ${Math.round(wordGoalPct ?? 0)}%`}
                  />
                </div>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
