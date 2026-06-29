'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Home, BookOpen, Zap, Hexagon, List, Users, ChevronDown, type LucideIcon } from 'lucide-react'

type Tab = 'home' | 'books' | 'sparks' | 'hives' | 'lists' | 'clubs'

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'books', label: 'Books', Icon: BookOpen },
  { id: 'sparks', label: 'Sparks', Icon: Zap },
  { id: 'hives', label: 'Hives', Icon: Hexagon },
  { id: 'lists', label: 'Lists', Icon: List },
  { id: 'clubs', label: 'Clubs', Icon: Users },
]

export function DiscoverTabs({ currentTab }: { currentTab: Tab }) {
  const router = useRouter()
  const pathname = usePathname()
  // Extract locale from pathname (first segment after leading slash)
  const locale = pathname.split('/')[1]

  // Mobile (issue #50): the tab strip collapses to a dropdown selector.
  const [open, setOpen] = useState(false)
  const current = TABS.find((t) => t.id === currentTab) ?? TABS[0]
  const CurrentIcon = current.Icon
  useEffect(() => {
    setOpen(false)
  }, [currentTab])

  return (
    <>
      {/* Mobile: section dropdown selector */}
      <div className="md:hidden relative w-full">
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
              style={{
                color: 'var(--canvas-dark-ink-strong)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
              }}
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
              <div className="py-1.5 px-1.5 flex flex-col gap-0.5">
                {TABS.map(({ id, label, Icon }) => {
                  const active = id === currentTab
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setOpen(false)
                        router.push(`/${locale}/discover?tab=${id}`)
                      }}
                      className="flex items-center gap-2.5 px-3 min-h-[44px] rounded-[var(--r-row)] text-left"
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
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop: tab strip (wrapper hides it on mobile — `.tabstrip` is an
          unlayered global with display:flex, so max-md:hidden must sit on a
          wrapper div, not the nav itself, to win the cascade). */}
      <div className="max-md:hidden">
        <nav className="tabstrip" role="tablist" aria-label="Discover sections">
          {TABS.map((tab) => (
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
      </div>
    </>
  )
}
