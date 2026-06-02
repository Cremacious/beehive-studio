'use client'

import { useEffect, useState } from 'react'

const TABS = [
  { id: 'chapters', label: 'Chapters' },
  { id: 'comments', label: 'Comments' },
  { id: 'about', label: 'About' },
] as const

type TabId = (typeof TABS)[number]['id']

export function BookTabStrip() {
  const [activeId, setActiveId] = useState<TabId>('chapters')

  useEffect(() => {
    const sectionEls = TABS.map((t) => document.getElementById(t.id)).filter(
      (el): el is HTMLElement => el !== null
    )
    if (sectionEls.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (top) setActiveId(top.target.id as TabId)
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    sectionEls.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const handleClick = (id: TabId) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      className="sticky top-0 z-10 -mx-2 my-4 flex gap-1 rounded-[var(--r-pill)] px-2 py-1.5 backdrop-blur"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
      aria-label="Book sections"
    >
      {TABS.map((t) => {
        const isActive = activeId === t.id
        return (
          <a
            key={t.id}
            href={`#${t.id}`}
            onClick={handleClick(t.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-[var(--r-pill)] px-4 py-1.5 text-sm transition-colors ${
              isActive
                ? 'bg-[var(--brand)] font-semibold text-[var(--brand-ink)]'
                : 'text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]'
            }`}
          >
            {t.label}
          </a>
        )
      })}
    </nav>
  )
}
