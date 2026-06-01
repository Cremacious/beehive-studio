'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { CATEGORY_TEMPLATES, CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import type { HiveWikiEntry } from '@/lib/actions/hive-content.actions'
import { EntryCard } from './entry-card'

export function ByCategoryView({
  entries,
  canEdit,
  onOpenEntry,
  onAddEntry,
}: {
  entries: HiveWikiEntry[]
  canEdit: boolean
  onOpenEntry: (id: string) => void
  onAddEntry: () => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <div className="space-y-6">
      {CATEGORY_TEMPLATES.map(t => {
        const matched = entries.filter(e => e.category === t.category)
        if (matched.length === 0 && !canEdit) return null
        const isCollapsed = collapsed[t.category]
        const Icon = t.icon
        return (
          <section key={t.category}>
            <button
              type="button"
              onClick={() => setCollapsed(prev => ({ ...prev, [t.category]: !prev[t.category] }))}
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-tile)',
                borderLeft: `3px solid var(${t.accentColor})`,
              }}
              className="w-full flex items-center gap-3 px-4 py-3"
            >
              {isCollapsed ? (
                <ChevronRight size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              ) : (
                <ChevronDown size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              )}
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-md"
                style={{
                  color: `var(${t.accentColor})`,
                  background: `oklch(from var(${t.accentColor}) l c h / 0.14)`,
                }}
              >
                <Icon size={13} />
              </span>
              <span
                className="font-comfortaa font-semibold text-sm"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                {t.label}
              </span>
              <span
                className="ml-auto text-xs font-mono"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {matched.length}
              </span>
            </button>
            {!isCollapsed && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matched.map(e => (
                  <EntryCard key={e.id} entry={e} onClick={() => onOpenEntry(e.id)} />
                ))}
                {matched.length === 0 && canEdit && (
                  <button
                    type="button"
                    onClick={onAddEntry}
                    className="text-left text-xs text-[var(--canvas-dark-ink-muted)] hover:text-brand inline-flex items-center gap-1.5 py-3"
                  >
                    <Plus size={12} /> Add a {t.label}
                  </button>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export function getCategoryLabel(c: WikiCategory): string {
  return CATEGORY_TEMPLATE_MAP[c].label
}
