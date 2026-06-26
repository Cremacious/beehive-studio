'use client'

import { useEffect, useState } from 'react'
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
  ChevronDown,
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

  // Mobile section picker (issue #50). Desktop keeps the vertical sidebar.
  const [open, setOpen] = useState(false)
  const current = NAV_ITEMS.find((i) => isActive(i.segment)) ?? NAV_ITEMS[0]
  const CurrentIcon = current.icon
  // Close the dropdown whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      {/* Mobile: full-width current-section selector → dropdown (variant A). */}
      <div className="md:hidden relative w-full mb-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 px-3.5 min-h-[46px] rounded-[var(--r-row)]"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            border: 'var(--br-card)',
          }}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <CurrentIcon size={16} style={{ color: 'var(--brand)' }} className="shrink-0" />
            <span
              className="truncate"
              style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}
            >
              {current.label}
            </span>
          </span>
          <ChevronDown
            size={16}
            className="shrink-0"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
            }}
          />
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              role="listbox"
              className="absolute left-0 right-0 z-50 overflow-hidden"
              style={{
                top: 'calc(100% + 6px)',
                borderRadius: 'var(--r-card)',
                background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
                boxShadow: 'var(--sh-card)',
                border: 'var(--br-card)',
              }}
            >
              <div className="max-h-[60vh] overflow-y-auto py-1.5 px-1.5 flex flex-col gap-0.5">
                {NAV_ITEMS.map(({ label, icon: Icon, segment }) => {
                  const active = isActive(segment)
                  return (
                    <Link
                      key={segment}
                      href={base + segment}
                      role="option"
                      aria-selected={active}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 min-h-[44px] rounded-[var(--r-row)] no-underline"
                      style={{
                        background: active
                          ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                          : undefined,
                        boxShadow: active ? 'var(--sh-tile)' : undefined,
                      }}
                    >
                      <Icon
                        size={16}
                        className="shrink-0"
                        style={{ color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
                      />
                      <span
                        className="truncate"
                        style={{
                          color: active ? 'var(--canvas-dark-ink-strong)' : 'var(--canvas-dark-ink)',
                          fontSize: 14,
                        }}
                      >
                        {label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

    <aside
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      className="w-[260px] shrink-0 flex flex-col overflow-hidden max-md:hidden"
    >
      <div
        className="px-4 py-4 flex items-center justify-center"
        style={{ borderBottom: 'var(--br-card)' }}
      >
        <h2
          style={{ color: 'var(--brand)' }}
          className="font-comfortaa font-bold text-base truncate text-center"
        >
          {hiveName}
        </h2>
      </div>
      <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
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
                  ? 'flex flex-col gap-1 px-3 py-2 text-sm transition-colors text-[var(--canvas-dark-ink-strong)]'
                  : 'flex flex-col gap-1 px-3 py-2 text-sm transition-colors text-[var(--canvas-dark-ink)] hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]'
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
    </>
  )
}
