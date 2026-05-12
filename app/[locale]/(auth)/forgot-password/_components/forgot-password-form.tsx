'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

const fieldClass =
  'w-full bg-[#252525] border border-border rounded-xl px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/[0.12] transition-all'

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

        {sentEmail ? (
          /* Success state */
          <div className="text-center">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/15 border border-brand/30 mb-6 success-ring">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </span>
            <h2 className="mainFont font-bold text-[24px] leading-tight">Check your inbox</h2>
            <p className="text-white/55 text-[14.5px] mt-2.5 leading-relaxed">
              We sent a reset link to<br/>
              <span className="text-white font-medium">{sentEmail}</span>
            </p>
            <p className="text-white/40 text-[13px] mt-4 leading-relaxed">
              Didn&apos;t get it? Check your spam folder or{' '}
              <button onClick={resetToForm} className="text-brand hover:underline underline-offset-4">
                try again
              </button>.
            </p>
          </div>
        ) : (
          /* Form state */
          <div>
            <div className="mb-7">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/15 border border-brand/30 mb-5">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </span>
              <h1 className="mainFont font-bold text-[28px] leading-tight">Reset your password</h1>
              <p className="text-white/55 text-[14.5px] mt-2.5 leading-relaxed">Enter your email and we&apos;ll send you a reset link.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-white/80 mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={fieldClass}
                />
              </div>

              {error && (
                <p className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full w-full px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 mt-2 shadow-[0_6px_24px_-10px_rgba(255,195,0,0.55)] hover:bg-brand-hover hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
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
