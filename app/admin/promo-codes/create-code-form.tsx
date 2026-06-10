'use client'

import { useState, useTransition } from 'react'
import { createPromoCodeAction } from './actions'

const fieldStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink-strong)',
}

const labelClass =
  'text-[10px] font-mono uppercase tracking-[0.14em]'

export function CreateCodeForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let out = ''
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
    return out
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null)
          setSuccess(null)
          const result = await createPromoCodeAction(fd)
          if (!result.ok) setError(result.error ?? 'Failed.')
          else setSuccess('Code created.')
        })
      }
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
    >
      <label className="flex flex-col gap-1.5 col-span-1">
        <span className={labelClass} style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Code
        </span>
        <div className="flex gap-2">
          <input
            name="code"
            required
            placeholder="WELCOME30"
            className="h-9 flex-1 rounded-[var(--r-row)] px-3 text-sm uppercase tracking-wider outline-none focus:ring-2"
            style={fieldStyle}
            defaultValue=""
            id="promo-code-input"
          />
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('promo-code-input') as HTMLInputElement | null
              if (el) el.value = randomCode()
            }}
            className="h-9 px-2 text-xs rounded-[var(--r-row)]"
            style={{ background: 'var(--canvas-dark-300)', color: 'var(--canvas-dark-ink-strong)' }}
          >
            ⟳
          </button>
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass} style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Grants
        </span>
        <select
          name="kind"
          required
          className="h-9 rounded-[var(--r-row)] px-3 text-sm outline-none focus:ring-2"
          style={fieldStyle}
          defaultValue="DAYS_30"
        >
          <option value="DAYS_30">30 days premium</option>
          <option value="DAYS_90">90 days premium</option>
          <option value="DAYS_365">1 year premium</option>
          <option value="LIFETIME">Lifetime premium</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass} style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Max uses (optional)
        </span>
        <input
          name="maxUses"
          type="number"
          min={1}
          placeholder="Unlimited"
          className="h-9 rounded-[var(--r-row)] px-3 text-sm outline-none focus:ring-2"
          style={fieldStyle}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass} style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Note (optional)
        </span>
        <input
          name="note"
          placeholder="Launch promo, podcast, etc."
          className="h-9 rounded-[var(--r-row)] px-3 text-sm outline-none focus:ring-2"
          style={fieldStyle}
        />
      </label>

      <div className="col-span-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-9 px-5 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {pending ? 'Creating…' : 'Create code'}
        </button>
        {error && <span className="text-sm" style={{ color: 'oklch(0.7 0.2 25)' }}>{error}</span>}
        {success && <span className="text-sm" style={{ color: 'oklch(0.75 0.15 145)' }}>{success}</span>}
      </div>
    </form>
  )
}
