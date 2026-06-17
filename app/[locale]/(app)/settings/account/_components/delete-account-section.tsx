'use client'

import { useState, useTransition } from 'react'
import { deleteOwnAccountAction } from '@/lib/actions/account.actions'

export function DeleteAccountSection({ locale }: { locale: string }) {
  const [confirmed, setConfirmed] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isReady = confirmed === 'delete my account'

  function handleDelete() {
    if (!isReady) return
    startTransition(async () => {
      setError(null)
      const result = await deleteOwnAccountAction()
      if (!result.success) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      // Session cookie is now stale (user row deleted). Navigate to sign-in.
      window.location.href = `/${locale}/sign-in`
    })
  }

  return (
    <section
      className="mt-8 rounded-[20px] p-6"
      style={{
        border: '1px solid oklch(0.62 0.18 25 / 0.35)',
        background: 'oklch(0.62 0.18 25 / 0.05)',
      }}
    >
      <h2
        className="mainFont font-bold text-[16px] mb-1"
        style={{ color: 'oklch(0.72 0.16 25)' }}
      >
        Danger Zone
      </h2>
      <p
        className="text-[13.5px] mb-5 leading-relaxed"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        Deleting your account is permanent and cannot be undone. All your books,
        chapters, hives, sparks, reading lists, and profile data will be removed.
        Any active subscription will be cancelled.
      </p>

      <div className="space-y-3">
        <label
          htmlFor="delete-confirm"
          className="block text-[12px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Type <strong style={{ color: 'var(--canvas-dark-ink)' }}>delete my account</strong> to confirm
        </label>
        <input
          id="delete-confirm"
          type="text"
          value={confirmed}
          onChange={e => setConfirmed(e.target.value)}
          placeholder="delete my account"
          disabled={isPending}
          className="w-full px-4 py-3 text-[14px] rounded-[14px] focus:outline-none focus:ring-[3px] focus:ring-[oklch(0.62_0.18_25_/_0.35)] transition-all disabled:opacity-50"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        />

        {error && (
          <p
            className="text-[13px] rounded-xl px-4 py-3"
            style={{
              color: 'oklch(0.72 0.16 25)',
              background: 'oklch(0.62 0.18 25 / 0.10)',
              border: '1px solid oklch(0.62 0.18 25 / 0.25)',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={!isReady || isPending}
          className="px-5 py-2.5 text-[14px] font-semibold rounded-[14px] disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:-translate-y-px disabled:transform-none"
          style={{
            background: isReady ? 'oklch(0.62 0.18 25)' : 'oklch(0.62 0.18 25 / 0.4)',
            color: '#fff',
          }}
        >
          {isPending ? 'Deleting account…' : 'Delete my account'}
        </button>
      </div>
    </section>
  )
}
