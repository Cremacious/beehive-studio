'use client'
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

type Props = {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * iOS Settings-style grouped tile for a single filter group.
 * Soft translucent surface, no outer border.
 */
export function FilterSection({ label, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      className="rounded-xl px-3 py-2.5"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--canvas-dark-ink-muted)]">
          {label}
        </span>
        {open ? (
          <ChevronDown size={12} className="text-[var(--canvas-dark-ink-muted)]" />
        ) : (
          <ChevronRight size={12} className="text-[var(--canvas-dark-ink-muted)]" />
        )}
      </button>
      {open ? <div className="space-y-1.5 mt-2">{children}</div> : null}
    </section>
  )
}
