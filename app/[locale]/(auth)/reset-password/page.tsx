import Link from 'next/link'
import { ResetPasswordForm } from './_components/reset-password-form'

export const metadata = { title: 'Set new password — Beehive Studio' }

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  border: 'var(--br-card)',
  color: 'var(--canvas-dark-ink-strong, #fff)',
}

const ctaStyle: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'var(--brand-ink)',
  borderRadius: 'var(--r-pill)',
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { locale } = await params
  const { token, error } = await searchParams

  const isInvalid = error === 'INVALID_TOKEN' || (!token && !error)

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#262728', color: 'var(--canvas-dark-ink-strong, #fff)' }}
    >
      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <span
              className="mainFont font-bold text-[17px] tracking-tight"
              style={{ color: 'var(--brand)' }}
            >
              Beehive Studio
            </span>
          </Link>
          <Link
            href={`/${locale}/sign-in`}
            className="text-sm transition-colors"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        {isInvalid ? (
          /* Invalid / expired token */
          <div className="w-full max-w-[440px]">
            <div className="p-8 sm:p-10" style={panelStyle}>
              <h1 className="mainFont font-bold text-[22px] leading-tight" style={{ color: 'var(--brand)' }}>
                Link expired
              </h1>
              <p className="text-[14.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                This reset link is invalid or has expired. Reset links are valid for 1 hour.
              </p>
              <Link
                href={`/${locale}/forgot-password`}
                className="mt-6 inline-flex items-center justify-center gap-2 mainFont font-bold px-6 py-3 text-[14.5px] hover:-translate-y-px transition-all"
                style={ctaStyle}
              >
                Request a new link
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <ResetPasswordForm locale={locale} token={token!} />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6">
        <div
          className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-[12px]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <div>© 2026 Beehive Studio</div>
          <div className="flex items-center gap-5">
            <Link href={`/${locale}/privacy`} className="hover:opacity-80 transition-opacity">Privacy</Link>
            <Link href={`/${locale}/terms`} className="hover:opacity-80 transition-opacity">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
