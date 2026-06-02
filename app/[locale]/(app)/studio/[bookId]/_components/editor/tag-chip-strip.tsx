'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { acceptTag, MAX_TAGS } from '@/lib/wiki/tags'

export function TagChipStrip({
  tags, onChange, accentColor, readOnly = false, disableAdd = false,
}: {
  tags: string[]
  onChange: (next: string[]) => void
  accentColor: string
  readOnly?: boolean
  /** Hide the + tag affordance — consumers that don't want users adding tags inline. */
  disableAdd?: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  function commit() {
    const accepted = acceptTag(tags, draft)
    if (accepted) onChange([...tags, accepted])
    setDraft('')
    setAdding(false)
  }
  function remove(t: string) {
    onChange(tags.filter(x => x !== t))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(t => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ color: `var(${accentColor})`, background: `oklch(from var(${accentColor}) l c h / 0.14)` }}
        >
          {t}
          {!readOnly && (
            <button
              type="button"
              onClick={() => remove(t)}
              className="opacity-60 hover:opacity-100"
              aria-label={`Remove tag ${t}`}
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      {!readOnly && !disableAdd && tags.length < MAX_TAGS && (
        adding ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              if (e.key === 'Escape') { setAdding(false); setDraft('') }
            }}
            className="rounded-full border border-border bg-transparent px-2 py-0.5 text-[11px] outline-none focus:border-brand"
            placeholder="tag"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-brand hover:text-brand"
          >
            <Plus size={10} /> tag
          </button>
        )
      )}
    </div>
  )
}
