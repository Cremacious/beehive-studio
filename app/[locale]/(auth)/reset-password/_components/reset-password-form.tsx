'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

const fieldClass =
  'w-full bg-[#252525] border border-border rounded-xl px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/[0.12] transition-all'

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
  0: { hint: '8+ chars, an uppercase letter, and a number', label: '—', color: 'text-white/45' },
  1: { hint: 'Too weak — add length or a number', label: 'Weak', color: 'text-red-400' },
  2: { hint: 'Getting there — try adding a symbol', label: 'Fair', color: 'text-brand' },
  3: { hint: 'Nice. Solid password.', label: 'Strong', color: 'text-green-400' },
} as const

function segColor(strength: 0 | 1 | 2 | 3, index: number): string {
  if (strength === 0 || index >= strength) return 'bg-border'
  if (strength === 1) return 'bg-red-400'
  if (strength === 2) return 'bg-brand'
  return 'bg-green-400'
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
      <div className="w-full max-w-md">
        <div className="paper-stack bg-card rounded-2xl p-8 sm:p-10 text-center">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/15 border border-brand/30 mb-6 success-ring">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </span>
          <h2 className="mainFont font-bold text-[24px] leading-tight">Password updated</h2>
          <p className="text-white/55 text-[14.5px] mt-2.5 leading-relaxed">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <Link
            href={`/${locale}/sign-in`}
            className="mt-6 inline-flex items-center justify-center gap-2 bg-brand text-[#0a0a0a] font-bold mainFont rounded-full px-6 py-3 text-[14.5px] shadow-[0_6px_24px_-10px_rgba(255,195,0,0.55)] hover:bg-brand-hover hover:-translate-y-px transition-all"
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
    <div className="w-full max-w-md">
      <div className="paper-stack bg-card rounded-2xl p-8 sm:p-10">
        {/* Back link */}
        <Link
          href={`/${locale}/sign-in`}
          className="inline-flex items-center gap-2 text-[13.5px] text-white/60 hover:text-white transition-colors mb-7 group"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
          Back to sign in
        </Link>

        <div className="mb-7">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/15 border border-brand/30 mb-5">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
          <h1 className="mainFont font-bold text-[28px] leading-tight">Set new password</h1>
          <p className="text-white/55 text-[14.5px] mt-2.5 leading-relaxed">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-[13px] font-medium text-white/80 mb-1.5">New password</label>
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
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
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
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${segColor(strength, i)}`} />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11.5px] text-white/45">{meta.hint}</span>
                <span className={`text-[11.5px] font-medium tabular-nums ${meta.color}`}>{meta.label}</span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-[13px] font-medium text-white/80 mb-1.5">Confirm password</label>
            <div className="relative">
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={`${passwordsMismatch
                  ? 'w-full bg-[#252525] border border-red-400/50 rounded-xl px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-red-400/50 focus:ring-4 focus:ring-red-400/10 transition-all'
                  : fieldClass} pr-12`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-opacity ${passwordsMatch ? 'opacity-100' : 'opacity-0'}`}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </span>
            </div>
            {(passwordsMatch || passwordsMismatch) && (
              <p className={`text-[11.5px] mt-1.5 ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                {passwordsMatch ? 'Passwords match' : "Passwords don't match yet"}
              </p>
            )}
          </div>

          {error && (
            <p className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || passwordsMismatch || !password || !confirm}
            className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full w-full px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 mt-2 shadow-[0_6px_24px_-10px_rgba(255,195,0,0.55)] hover:bg-brand-hover hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
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
