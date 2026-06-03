'use client'

import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { CATEGORY_TEMPLATES, CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import type { HiveWikiEntry } from '@/lib/actions/hive-content.actions'
import { EntryCard } from './entry-card'

export function ByCategoryView({
  entries,
  canEdit,
  isSearching,
  onOpenEntry,
  onAddEntryInCategory,
}: {
  entries: HiveWikiEntry[]
  canEdit: boolean
  isSearching: boolean
  onOpenEntry: (id: string) => void
  onAddEntryInCategory: (category: WikiCategory) => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<WikiCategory | null>(null)

  // When searching, show flat grid of all matching entries across categories.
  if (isSearching) {
    if (entries.length === 0) {
      return (
        <p className="text-sm italic text-center py-12" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          No entries match your search.
        </p>
      )
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(e => (
          <EntryCard key={e.id} entry={e} onClick={() => onOpenEntry(e.id)} />
        ))}
      </div>
    )
  }

  // Level 2: list of entries in chosen category.
  if (selectedCategory) {
    const template = CATEGORY_TEMPLATE_MAP[selectedCategory]
    const matched = entries.filter(e => e.category === selectedCategory)
    const Icon = template.icon
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="inline-flex items-center gap-1.5 text-xs font-geist font-semibold hover:text-brand"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            <ArrowLeft size={12} /> All categories
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => onAddEntryInCategory(selectedCategory)}
              style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
              className="inline-flex items-center gap-1.5 text-xs font-geist font-semibold px-2.5 py-1.5 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
            >
              <Plus size={12} /> Add a {template.label}
            </button>
          )}
        </div>
        <header
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            borderRadius: 'var(--r-row)',
            boxShadow: 'var(--sh-tile)',
            borderLeft: `3px solid var(${template.accentColor})`,
          }}
          className="px-5 py-4 flex items-center gap-4"
        >
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-md"
            style={{
              color: `var(${template.accentColor})`,
              background: `oklch(from var(${template.accentColor}) l c h / 0.14)`,
            }}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-comfortaa font-bold text-lg" style={{ color: 'var(--canvas-dark-ink-strong)' }}>
              {template.label}
            </h2>
            <p className="text-xs" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              {template.blurb}
            </p>
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            {matched.length} {matched.length === 1 ? 'entry' : 'entries'}
          </span>
        </header>
        {matched.length === 0 ? (
          <div
            className="text-center py-12 px-4 rounded-md"
            style={{
              background: 'var(--canvas-dark-100)',
              boxShadow: 'var(--sh-inset)',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            <p className="text-sm italic mb-3">No entries in this category yet.</p>
            {canEdit && (
              <button
                type="button"
                onClick={() => onAddEntryInCategory(selectedCategory)}
                style={{ color: 'var(--brand)' }}
                className="inline-flex items-center gap-1.5 text-xs font-geist font-semibold"
              >
                <Plus size={12} /> Add the first {template.label}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matched.map(e => (
              <EntryCard key={e.id} entry={e} onClick={() => onOpenEntry(e.id)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Level 1: encyclopedia-style category grid.
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {CATEGORY_TEMPLATES.map(t => {
        const count = entries.filter(e => e.category === t.category).length
        const Icon = t.icon
        return (
          <button
            key={t.category}
            type="button"
            onClick={() => setSelectedCategory(t.category)}
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-tile)',
              border: 'var(--br-card)',
            }}
            className="text-left p-4 flex flex-col gap-2 min-h-[140px] hover:-translate-y-0.5 transition-transform"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                style={{
                  color: `var(${t.accentColor})`,
                  background: `oklch(from var(${t.accentColor}) l c h / 0.14)`,
                }}
              >
                <Icon size={18} />
              </span>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-full"
                style={{
                  color: '#ffffff',
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'var(--sh-inset)',
                }}
              >
                {count}
              </span>
            </div>
            <div
              className="font-comfortaa font-semibold text-base leading-tight"
              style={{ color: '#ffffff' }}
            >
              {t.label}
            </div>
            <div
              className="text-xs line-clamp-2"
              style={{ color: 'oklch(1 0 0 / 0.78)' }}
            >
              {t.blurb}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function getCategoryLabel(c: WikiCategory): string {
  return CATEGORY_TEMPLATE_MAP[c].label
}
