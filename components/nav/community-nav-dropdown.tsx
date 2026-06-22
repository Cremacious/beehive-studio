'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronDown,
  LayoutDashboard,
  Zap,
  Hexagon,
  Users,
  BookMarked,
  BookOpen,
  Bookmark,
} from 'lucide-react'

interface Props {
  locale: string
  active: boolean
}

type NavItem = { kind: 'item'; label: string; icon: LucideIcon; segment: string }
type NavSep  = { kind: 'sep' }
type NavEntry = NavItem | NavSep

const MENU: NavEntry[] = [
  { kind: 'item', label: 'Community Overview', icon: LayoutDashboard, segment: 'community' },
  { kind: 'sep' },
  { kind: 'item', label: 'Sparks',        icon: Zap,        segment: 'sparks' },
  { kind: 'item', label: 'Hives',         icon: Hexagon,    segment: 'hives' },
  { kind: 'item', label: 'Friends',       icon: Users,      segment: 'friends' },
  { kind: 'item', label: 'Reading Lists', icon: BookMarked, segment: 'reading-lists' },
  { kind: 'item', label: 'Clubs',         icon: BookOpen,   segment: 'clubs' },
  { kind: 'item', label: 'Bookmarks',     icon: Bookmark,   segment: 'bookmarks' },
]

const NAV_ITEMS = MENU.filter((e): e is NavItem => e.kind === 'item')

export function CommunityNavDropdown({ locale, active }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const pathname = usePathname()

  function isItemActive(segment: string) {
    if (segment === 'community') return pathname === `/${locale}/community`
    return pathname.startsWith(`/${locale}/${segment}`)
  }

  // Close on outside click / touch
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open) return

    const focusedIdx = itemRefs.current.findIndex((r) => r === document.activeElement)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = focusedIdx < NAV_ITEMS.length - 1 ? focusedIdx + 1 : 0
      itemRefs.current[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = focusedIdx > 0 ? focusedIdx - 1 : NAV_ITEMS.length - 1
      itemRefs.current[prev]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  // Reset collected refs each render (callback ref pattern)
  itemRefs.current = []

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={handleKeyDown}
    >
      {/* Trigger — clicking opens/closes the dropdown */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[12px] sm:text-[13px] font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        style={{ color: active ? 'var(--brand)' : 'var(--canvas-dark-ink)' }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--canvas-dark-ink-strong)' }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--canvas-dark-ink)' }}
      >
        Community
        <ChevronDown
          size={12}
          aria-hidden="true"
          style={{
            transition: 'transform 200ms',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="menu"
          aria-label="Community pages"
          className="absolute z-50 py-1.5 w-52"
          style={{
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            border: '1px solid oklch(1 0 0 / 0.06)',
            boxShadow: 'var(--sh-card)',
            borderRadius: 'var(--r-card)',
          }}
        >
          {(() => {
            let itemIdx = 0
            return MENU.map((entry, i) => {
              if (entry.kind === 'sep') {
                return (
                  <div
                    key={`sep-${i}`}
                    role="separator"
                    className="my-1 mx-2"
                    style={{ height: '1px', background: 'oklch(1 0 0 / 0.06)' }}
                  />
                )
              }
              const idx = itemIdx++
              const itemActive = isItemActive(entry.segment)
              const Icon = entry.icon
              return (
                <Link
                  key={entry.segment}
                  href={`/${locale}/${entry.segment}`}
                  role="menuitem"
                  ref={(el) => { itemRefs.current[idx] = el }}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 mx-1.5 text-[13px] no-underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
                  style={{
                    borderRadius: '8px',
                    color: itemActive ? 'var(--brand)' : 'var(--canvas-dark-ink)',
                    background: itemActive ? 'oklch(0.85 0.18 90 / 0.08)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = itemActive
                      ? 'oklch(0.85 0.18 90 / 0.12)'
                      : 'oklch(1 0 0 / 0.04)'
                    if (!itemActive) e.currentTarget.style.color = 'var(--canvas-dark-ink-strong)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = itemActive ? 'oklch(0.85 0.18 90 / 0.08)' : 'transparent'
                    e.currentTarget.style.color = itemActive ? 'var(--brand)' : 'var(--canvas-dark-ink)'
                  }}
                >
                  <Icon
                    size={14}
                    aria-hidden="true"
                    style={{
                      color: itemActive ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                      flexShrink: 0,
                    }}
                  />
                  {entry.label}
                </Link>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
