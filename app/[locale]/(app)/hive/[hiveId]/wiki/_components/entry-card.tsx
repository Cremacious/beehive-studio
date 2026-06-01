'use client'

import type { HiveWikiEntry } from '@/lib/actions/hive-content.actions'
import { CATEGORY_TEMPLATE_MAP } from '@/lib/wiki/category-templates'

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function EntryCard({ entry, onClick }: { entry: HiveWikiEntry; onClick: () => void }) {
  const template = CATEGORY_TEMPLATE_MAP[entry.category]
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
      }}
      className="text-left p-4 flex flex-col gap-2 min-h-[120px] hover:-translate-y-0.5 transition-transform"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            color: `var(${template.accentColor})`,
            background: `oklch(from var(${template.accentColor}) l c h / 0.14)`,
          }}
        >
          {template.label}
        </span>
        <span
          className="text-[10px]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {relTime(entry.lastEditedAt)}
        </span>
      </div>
      <div
        className="font-comfortaa font-semibold text-sm leading-tight truncate"
        style={{ color: 'var(--canvas-dark-ink-strong)' }}
      >
        {entry.title}
      </div>
      {entry.excerpt && (
        <div
          className="text-xs line-clamp-2"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {entry.excerpt}
        </div>
      )}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.tags.slice(0, 4).map(t => (
            <span
              key={t}
              className="text-[10px] rounded px-1.5 py-0.5"
              style={{
                color: `var(${template.accentColor})`,
                background: `oklch(from var(${template.accentColor}) l c h / 0.10)`,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {entry.authorUsername && (
        <div
          className="text-[10px] mt-auto font-mono"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          @{entry.authorUsername}
        </div>
      )}
    </button>
  )
}
