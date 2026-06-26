'use client'

import { useState, useTransition } from 'react'
import { redeemPromoCodeAction } from './actions'

export function RedeemForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null)
          setSuccess(null)
          const result = await redeemPromoCodeAction(fd)
          if (!result.ok) setError(result.error ?? 'Could not redeem.')
          else setSuccess(`You've unlocked ${result.grantLabel}.`)
        })
      }
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.14em]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Code
        </span>
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="WELCOME30"
          className="h-10 rounded-[var(--r-row)] px-3 text-sm uppercase tracking-wider outline-none focus:ring-2"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        />
      </label>
      {error && (
        <p className="text-sm" style={{ color: 'oklch(0.7 0.2 25)' }}>
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm" style={{ color: 'oklch(0.75 0.15 145)' }}>
          {success}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-5 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-60"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        {pending ? 'Redeeming…' : 'Redeem'}
      </button>
    </form>
  )
}
