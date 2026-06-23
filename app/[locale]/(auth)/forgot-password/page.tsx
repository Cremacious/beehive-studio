import Link from 'next/link'
import { ForgotPasswordForm } from './_components/forgot-password-form'

export const metadata = { title: 'Reset password · Beehive Studio' }

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse 80% 55% at 50% 0%, oklch(from var(--brand) l c h / 0.07), transparent 60%), #262728', color: 'var(--canvas-dark-ink-strong, #fff)' }}
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
        <ForgotPasswordForm locale={locale} />
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
