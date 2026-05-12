'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn, signUp } from '@/lib/auth-client'

const fieldClass =
  'w-full bg-[#252525] border border-border rounded-xl px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/[0.12] transition-all'

const fieldErrorClass =
  'w-full bg-[#252525] border border-red-400/50 rounded-xl px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-red-400/50 focus:ring-4 focus:ring-red-400/10 transition-all'

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

export function SignUpForm({ locale }: { locale: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = getStrength(password)
  const meta = strengthMeta[strength]
  const passwordsMatch = confirm !== '' && confirm === password
  const passwordsMismatch = confirm !== '' && confirm !== password

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) return
    setError(null)
    setLoading(true)
    const result = await signUp.email({ email, password, name: email })
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
    } else {
      window.location.href = `/${locale}/onboarding`
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    await signIn.social({ provider: 'google', callbackURL: `/${locale}/studio` })
  }

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="paper-stack bg-card rounded-2xl p-8 sm:p-10">
        <div className="mb-7 text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/15 border border-brand/30 mb-5">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#FFC300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
              <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="#FFC300" fillOpacity="0.6" stroke="none"/>
            </svg>
          </span>
          <h1 className="mainFont font-bold text-[30px] leading-tight">Join the hive</h1>
          <p className="text-white/60 text-[14.5px] mt-2">Free forever for solo writers. No credit card.</p>
        </div>

        {/* Social buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="bg-[#252525] border border-border rounded-xl px-4 py-3 w-full flex items-center justify-center gap-2.5 text-[14.5px] font-medium hover:border-brand/35 hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px]"
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07Z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23Z" fill="#34A853"/>
              <path d="M5.84 14.12A6.6 6.6 0 0 1 5.48 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84Z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting…' : 'Sign up with Google'}
          </button>

          <button
            type="button"
            disabled
            className="bg-[#252525] border border-border rounded-xl px-4 py-3 w-full flex items-center justify-center gap-2.5 text-[14.5px] font-medium opacity-50 cursor-not-allowed min-h-[48px] relative"
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="currentColor" aria-hidden="true">
              <path d="M16.365 12.71c-.02-2.07 1.69-3.06 1.77-3.11-.96-1.41-2.47-1.6-3.01-1.62-1.28-.13-2.5.75-3.15.75-.65 0-1.66-.73-2.73-.71-1.4.02-2.69.82-3.41 2.07-1.46 2.52-.37 6.24 1.04 8.28.69.99 1.5 2.11 2.57 2.07 1.04-.04 1.43-.67 2.69-.67s1.6.67 2.7.65c1.12-.02 1.83-1.01 2.51-2.01.79-1.16 1.12-2.29 1.14-2.35-.03-.01-2.19-.84-2.21-3.35ZM14.31 6.69c.57-.69.95-1.65.85-2.6-.82.03-1.81.55-2.4 1.24-.53.61-.99 1.59-.87 2.52.91.07 1.84-.47 2.42-1.16Z"/>
            </svg>
            <span>Sign up with Apple</span>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider font-semibold text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
              Soon
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border"/>
          <span className="text-[11.5px] uppercase tracking-wider text-white/40 font-medium">or continue with email</span>
          <div className="flex-1 h-px bg-border"/>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[13px] font-medium text-white/80 mb-1.5">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[13px] font-medium text-white/80 mb-1.5">Password</label>
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
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${segColor(strength, i)}`}
                  />
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
                className={`${passwordsMismatch ? fieldErrorClass : fieldClass} pr-12`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-opacity ${passwordsMatch ? 'opacity-100' : 'opacity-0'}`}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </span>
            </div>
            {(passwordsMatch || passwordsMismatch) && (
              <p className={`text-[11.5px] mt-1.5 transition-opacity ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
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
            disabled={loading || googleLoading || passwordsMismatch}
            className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full w-full px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 mt-2 shadow-[0_6px_24px_-10px_rgba(255,195,0,0.55)] hover:bg-brand-hover hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
          >
            {loading ? 'Creating account…' : 'Create account'}
            {!loading && (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            )}
          </button>

          <p className="text-center text-[12px] text-white/40 leading-relaxed pt-1">
            By creating an account you agree to our{' '}
            <Link href={`/${locale}/terms`} className="text-brand hover:underline underline-offset-4">Terms</Link>
            {' '}and{' '}
            <Link href={`/${locale}/privacy`} className="text-brand hover:underline underline-offset-4">Privacy Policy</Link>.
          </p>
        </form>
      </div>

      {/* Bottom link */}
      <p className="text-center text-[14px] text-white/60 mt-6">
        Already have an account?{' '}
        <Link href={`/${locale}/sign-in`} className="text-brand font-medium hover:underline underline-offset-4 ml-1">
          Sign in
        </Link>
      </p>
    </div>
  )
}
