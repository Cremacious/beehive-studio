'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from '@/lib/auth-client'

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

const tileStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  boxShadow: 'var(--sh-tile)',
  borderRadius: 'var(--r-row)',
  border: 'var(--br-card)',
  color: 'var(--canvas-dark-ink-strong, #fff)',
}

const ctaStyle: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'var(--brand-ink)',
  borderRadius: 'var(--r-pill)',
}

const fieldClass =
  'w-full px-4 py-3.5 text-[15px] placeholder:opacity-40 focus:outline-none focus:ring-[3px] focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.18)] transition-all'

export function SignInForm({ locale }: { locale: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callbackURL = `/${locale}/studio`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await signIn.email({ email, password, rememberMe })
    if (result.error) {
      setError(result.error.message ?? 'Invalid email or password.')
      setLoading(false)
    } else {
      window.location.href = callbackURL
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    await signIn.social({ provider: 'google', callbackURL })
  }

  return (
    <div className="w-full max-w-[440px]">
      {/* Card */}
      <div className="p-8 sm:p-10" style={panelStyle}>
        <div className="mb-7">
          <h1
            className="mainFont font-bold text-[22px] leading-tight"
            style={{ color: 'var(--brand)' }}
          >
            Welcome back
          </h1>
          <p
            className="text-[14.5px] mt-2"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Sign in to keep building your hive.
          </p>
        </div>

        {/* Social buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="px-4 py-3 w-full flex items-center justify-center gap-2.5 text-[14.5px] font-medium hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all min-h-[48px]"
            style={tileStyle}
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07Z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23Z" fill="#34A853"/>
              <path d="M5.84 14.12A6.6 6.6 0 0 1 5.48 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84Z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <button
            type="button"
            disabled
            className="px-4 py-3 w-full flex items-center justify-center gap-2.5 text-[14.5px] font-medium opacity-50 cursor-not-allowed min-h-[48px] relative"
            style={tileStyle}
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="currentColor" aria-hidden="true">
              <path d="M16.365 12.71c-.02-2.07 1.69-3.06 1.77-3.11-.96-1.41-2.47-1.6-3.01-1.62-1.28-.13-2.5.75-3.15.75-.65 0-1.66-.73-2.73-.71-1.4.02-2.69.82-3.41 2.07-1.46 2.52-.37 6.24 1.04 8.28.69.99 1.5 2.11 2.57 2.07 1.04-.04 1.43-.67 2.69-.67s1.6.67 2.7.65c1.12-.02 1.83-1.01 2.51-2.01.79-1.16 1.12-2.29 1.14-2.35-.03-.01-2.19-.84-2.21-3.35ZM14.31 6.69c.57-.69.95-1.65.85-2.6-.82.03-1.81.55-2.4 1.24-.53.61-.99 1.59-.87 2.52.91.07 1.84-.47 2.42-1.16Z"/>
            </svg>
            <span>Continue with Apple</span>
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5"
              style={{ color: 'var(--brand)', background: 'oklch(from var(--brand) l c h / 0.12)' }}
            >
              Soon
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: 'oklch(1 0 0 / 0.06)' }}/>
          <span
            className="text-[11px] uppercase tracking-wider font-medium font-mono"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            or continue with email
          </span>
          <div className="flex-1 h-px" style={{ background: 'oklch(1 0 0 / 0.06)' }}/>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-[12px] font-mono uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={fieldClass}
              style={inputStyle}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-[12px] font-mono uppercase tracking-wider"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Password
              </label>
              <Link
                href={`/${locale}/forgot-password`}
                className="text-[12.5px] hover:underline underline-offset-4"
                style={{ color: 'var(--brand)' }}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
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
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="sr-only"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span
                className="w-4 h-4 rounded-md flex items-center justify-center transition-colors"
                style={
                  rememberMe
                    ? { background: 'var(--brand)' }
                    : { background: 'var(--canvas-dark-100)', boxShadow: 'var(--sh-inset)' }
                }
              >
                <svg viewBox="0 0 24 24" className={`w-3 h-3 transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`} style={{ color: 'var(--brand-ink)' }} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </span>
              <span className="text-[13px]" style={{ color: 'var(--canvas-dark-ink)' }}>Keep me signed in</span>
            </label>
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
            disabled={loading || googleLoading}
            className="mainFont font-bold w-full px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 mt-2 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
            style={ctaStyle}
          >
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading && (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            )}
          </button>
        </form>
      </div>

      {/* Bottom link */}
      <p
        className="text-center text-[14px] mt-6"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        Don&apos;t have an account?{' '}
        <Link
          href={`/${locale}/sign-up`}
          className="font-medium hover:underline underline-offset-4 ml-1"
          style={{ color: 'var(--brand)' }}
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}
