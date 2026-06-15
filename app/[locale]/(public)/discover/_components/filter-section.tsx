'use client'
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

type Props = {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}

export function FilterSection({ label, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left mb-2"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--brand)]">
          {label}
        </span>
        {open ? (
          <ChevronDown size={12} className="text-[var(--canvas-dark-ink-muted)]" />
        ) : (
          <ChevronRight size={12} className="text-[var(--canvas-dark-ink-muted)]" />
        )}
      </button>
      {open ? <div className="space-y-1.5">{children}</div> : null}
    </section>
  )
}
