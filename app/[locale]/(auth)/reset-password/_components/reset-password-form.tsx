'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  border: 'var(--br-card)',
  color: 'var(--canvas-dark-ink-strong, #fff)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  borderRadius: 'var(--r-row)',
  color: 'var(--canvas-dark-ink-strong, #fff)',
  border: '1px solid transparent',
}

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: '1px solid oklch(0.62 0.18 25 / 0.55)',
}

const ctaStyle: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'var(--brand-ink)',
  borderRadius: 'var(--r-pill)',
}

const fieldClass =
  'w-full px-4 py-3.5 text-[15px] placeholder:opacity-40 focus:outline-none focus:ring-[3px] focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.18)] transition-all'

function getStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++
  if (s <= 1) return 1
  if (s === 2) return 2
  return 3
}

const strengthMeta = {
  0: { hint: '8+ chars, an uppercase letter, and a number', label: '–', color: 'var(--canvas-dark-ink-muted)' },
  1: { hint: 'Too weak. Add length or a number.', label: 'Weak', color: 'oklch(0.72 0.16 25)' },
  2: { hint: 'Getting there. Try adding a symbol.', label: 'Fair', color: 'var(--brand)' },
  3: { hint: 'Nice. Solid password.', label: 'Strong', color: 'oklch(0.72 0.16 145)' },
} as const

function segColor(strength: 0 | 1 | 2 | 3, index: number): string {
  if (strength === 0 || index >= strength) return 'oklch(1 0 0 / 0.08)'
  if (strength === 1) return 'oklch(0.72 0.16 25)'
  if (strength === 2) return 'var(--brand)'
  return 'oklch(0.72 0.16 145)'
}

export function ResetPasswordForm({ locale, token }: { locale: string; token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const strength = getStrength(password)
  const meta = strengthMeta[strength]
  const passwordsMatch = confirm !== '' && confirm === password
  const passwordsMismatch = confirm !== '' && confirm !== password

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) return
    setError(null)
    setLoading(true)
    const result = await authClient.resetPassword({ newPassword: password, token })
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-[440px]">
        <div className="p-8 sm:p-10" style={panelStyle}>
          <h2 className="mainFont font-bold text-[22px] leading-tight" style={{ color: 'var(--brand)' }}>
            Password updated
          </h2>
          <p className="text-[14.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Your password has been reset. You can now sign in with your new password.
          </p>
          <Link
            href={`/${locale}/sign-in`}
            className="mt-6 inline-flex items-center justify-center gap-2 mainFont font-bold px-6 py-3 text-[14.5px] hover:-translate-y-px transition-all"
            style={ctaStyle}
          >
            Sign in
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[440px]">
      <div className="p-8 sm:p-10" style={panelStyle}>
        {/* Back link */}
        <Link
          href={`/${locale}/sign-in`}
          className="inline-flex items-center gap-2 text-[13.5px] transition-colors mb-7 group"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
          Back to sign in
        </Link>

        <div className="mb-7">
          <h1 className="mainFont font-bold text-[22px] leading-tight" style={{ color: 'var(--brand)' }}>
            Set new password
          </h1>
          <p className="text-[14.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-[12px] font-mono uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`${fieldClass} pr-12`}
                style={inputStyle}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Strength meter */}
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-colors duration-200"
                    style={{ background: segColor(strength, i) }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11.5px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>{meta.hint}</span>
                <span className="text-[11.5px] font-medium tabular-nums" style={{ color: meta.color }}>{meta.label}</span>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block text-[12px] font-mono uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={`${fieldClass} pr-12`}
                style={passwordsMismatch ? inputErrorStyle : inputStyle}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-opacity ${passwordsMatch ? 'opacity-100' : 'opacity-0'}`}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ color: 'oklch(0.72 0.16 145)' }} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </span>
            </div>
            {(passwordsMatch || passwordsMismatch) && (
              <p
                className="text-[11.5px] mt-1.5"
                style={{ color: passwordsMatch ? 'oklch(0.72 0.16 145)' : 'oklch(0.72 0.16 25)' }}
              >
                {passwordsMatch ? 'Passwords match' : "Passwords don't match yet"}
              </p>
            )}
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

          <button
            type="submit"
            disabled={loading || passwordsMismatch || !password || !confirm}
            className="mainFont font-bold w-full px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 mt-2 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
            style={ctaStyle}
          >
            {loading ? 'Saving…' : 'Save new password'}
            {!loading && (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
