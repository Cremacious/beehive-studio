'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

export function PasswordSection() {
  const [isPending, startTransition] = useTransition()
  const [fields, setFields] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function set(key: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }))
    setError(null)
    setSuccess(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (fields.newPassword !== fields.confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (fields.newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    startTransition(async () => {
      try {
        const result = await authClient.changePassword({
          currentPassword: fields.currentPassword,
          newPassword: fields.newPassword,
          revokeOtherSessions: false,
        })
        if (result.error) {
          setError(result.error.message ?? 'Password change failed.')
          return
        }
        setSuccess(true)
        setFields({ currentPassword: '', newPassword: '', confirmPassword: '' })
        toast.success('Password updated.')
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  const inputStyle = {
    background: 'var(--canvas-dark-100)',
    boxShadow: 'var(--sh-inset)',
    color: 'var(--canvas-dark-ink-strong)',
    borderRadius: 'var(--r-row)',
  } as const

  const labelStyle = {
    color: 'var(--canvas-dark-ink-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" style={labelStyle}>
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          value={fields.currentPassword}
          onChange={(e) => set('currentPassword', e.target.value)}
          placeholder="Enter current password"
          autoComplete="current-password"
          disabled={isPending}
          required
          className="px-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 transition-all"
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="newPassword" style={labelStyle}>
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            value={fields.newPassword}
            onChange={(e) => set('newPassword', e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            disabled={isPending}
            required
            className="px-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 transition-all"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" style={labelStyle}>
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={fields.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            placeholder="Same password again"
            autoComplete="new-password"
            disabled={isPending}
            required
            className="px-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 transition-all"
            style={inputStyle}
          />
        </div>
      </div>

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

      {success && (
        <p
          className="text-[13px] rounded-xl px-4 py-3"
          style={{
            color: 'oklch(0.75 0.15 150)',
            background: 'oklch(0.65 0.15 150 / 0.10)',
            border: '1px solid oklch(0.65 0.15 150 / 0.25)',
          }}
        >
          Password updated successfully.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !fields.currentPassword || !fields.newPassword || !fields.confirmPassword}
          className="px-5 py-2.5 text-[13px] font-semibold rounded-[12px] disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:-translate-y-px disabled:transform-none"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {isPending ? 'Updating...' : 'Update password'}
        </button>
      </div>
    </form>
  )
}
