import Link from 'next/link'
import { SignInForm } from './_components/sign-in-form'

export const metadata = { title: 'Sign in · Beehive Studio' }

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

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
            href={`/${locale}/sign-up`}
            className="text-sm transition-colors"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Create an account
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <SignInForm locale={locale} />
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
