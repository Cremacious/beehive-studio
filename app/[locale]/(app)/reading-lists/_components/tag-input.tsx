'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  maxChars?: number
}

export function TagInput({ value, onChange, max = 5, maxChars = 20 }: Props) {
  const [draft, setDraft] = useState('')

  const addTag = (raw: string) => {
    const normalized = raw.trim().toLowerCase().slice(0, maxChars)
    if (!normalized) return
    if (value.includes(normalized)) return
    if (value.length >= max) return
    onChange([...value, normalized])
  }

  const remove = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (draft.trim()) {
        addTag(draft)
        setDraft('')
      }
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault()
      remove(value[value.length - 1])
    }
  }

  const atMax = value.length >= max

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 p-2 rounded-[var(--r-row)] border min-h-[42px]"
      style={{
        background: 'var(--canvas-dark-100)',
        borderColor: 'var(--br-card)',
      }}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-pill)] text-xs font-medium"
          style={{
            background: 'color-mix(in oklch, var(--brand) 14%, transparent)',
            color: 'var(--brand)',
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="hover:opacity-70"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {!atMax && (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, maxChars))}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) {
              addTag(draft)
              setDraft('')
            }
          }}
          placeholder={value.length === 0 ? 'Add tags (press Enter)…' : ''}
          maxLength={maxChars}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-[var(--canvas-dark-ink)]"
        />
      )}
    </div>
  )
}
