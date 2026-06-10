'use client'

import { useState, useTransition } from 'react'
import { adminLoginAction } from './actions'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null)
          const result = await adminLoginAction(fd)
          if (result && !result.ok) setError(result.error ?? 'Login failed.')
        })
      }
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.14em]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="h-10 rounded-[var(--r-row)] px-3 text-sm outline-none focus:ring-2"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.14em]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Password
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-10 rounded-[var(--r-row)] px-3 text-sm outline-none focus:ring-2"
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
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-5 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-60"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
