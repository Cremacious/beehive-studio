'use client'

import { useState, useTransition } from 'react'
import { wipeDatabaseAction } from './actions'

export function WipeForm() {
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!window.confirm('You are about to wipe ALL app data. Continue?')) return
    startTransition(async () => {
      setError(null)
      setResult(null)
      const r = await wipeDatabaseAction(confirm)
      if (!r.ok) setError(r.error ?? 'Failed.')
      else
        setResult(
          `Wiped ${r.truncated?.length ?? 0} tables and ${r.imagesDeleted ?? 0} Cloudinary images.`,
        )
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.14em]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Type WIPE to confirm
        </span>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="WIPE"
          className="h-10 rounded-[var(--r-row)] px-3 text-sm uppercase tracking-wider outline-none focus:ring-2"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        />
      </label>
      {error && <p className="text-sm" style={{ color: 'oklch(0.72 0.2 25)' }}>{error}</p>}
      {result && (
        <p className="text-sm" style={{ color: 'oklch(0.75 0.15 145)' }}>
          {result}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || confirm !== 'WIPE'}
        className="h-9 px-5 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-40 w-fit"
        style={{
          background: 'oklch(0.72 0.2 25)',
          color: 'white',
        }}
      >
        {pending ? 'Wiping…' : 'Wipe everything'}
      </button>
    </form>
  )
}
