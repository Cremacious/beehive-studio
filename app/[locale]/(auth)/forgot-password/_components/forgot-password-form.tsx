'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { AuthStepIndicator } from '../../_components/auth-step-indicator'

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

const ctaStyle: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'var(--brand-ink)',
  borderRadius: 'var(--r-pill)',
}

const fieldClass =
  'w-full px-4 py-3.5 text-[15px] placeholder:opacity-40 focus:outline-none focus:ring-[3px] focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.18)] transition-all'

export function ForgotPasswordForm({ locale }: { locale: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentEmail, setSentEmail] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `/${locale}/reset-password`,
    })
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
    } else {
      setSentEmail(email)
    }
  }

  function resetToForm() {
    setSentEmail(null)
    setEmail('')
    setError(null)
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

        <AuthStepIndicator current={sentEmail ? 2 : 1} />

        {sentEmail ? (
          /* Success state */
          <div>
            <h2 className="mainFont font-bold text-[22px] leading-tight" style={{ color: 'var(--brand)' }}>
              Check your inbox
            </h2>
            <p className="text-[14.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              We sent a reset link to{' '}
              <span style={{ color: 'var(--canvas-dark-ink-strong)' }}>{sentEmail}</span>.
            </p>
            <p className="text-[13px] mt-4 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              Didn&apos;t get it? Check your spam folder or{' '}
              <button onClick={resetToForm} className="hover:underline underline-offset-4" style={{ color: 'var(--brand)' }}>
                try again
              </button>.
            </p>
          </div>
        ) : (
          /* Form state */
          <div>
            <div className="mb-7">
              <h1 className="mainFont font-bold text-[22px] leading-tight" style={{ color: 'var(--brand)' }}>
                Reset your password
              </h1>
              <p className="text-[14.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

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
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={fieldClass}
                  style={inputStyle}
                />
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
                disabled={loading}
                className="mainFont font-bold w-full px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 mt-2 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
                style={ctaStyle}
              >
                {loading ? 'Sending…' : 'Send reset link'}
                {!loading && (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
