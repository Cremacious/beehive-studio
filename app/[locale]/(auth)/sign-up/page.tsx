import Link from 'next/link'
import { SignUpForm } from './_components/sign-up-form'

export const metadata = { title: 'Join the hive — Beehive Studio' }

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed backdrop */}
      <div className="fixed inset-0 hex-bg opacity-50 pointer-events-none [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent_75%)]"/>
      <div className="fixed inset-0 auth-glow pointer-events-none"/>

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand/15 border border-brand/30">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#FFC300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
                <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="#FFC300" fillOpacity="0.6" stroke="none"/>
              </svg>
            </span>
            <span className="mainFont font-bold text-[17px] tracking-tight">Beehive Studio</span>
          </Link>
          <Link href={`/${locale}/sign-in`} className="text-sm text-white/60 hover:text-white transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <SignUpForm locale={locale} />
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/40">
          <div>© 2026 Beehive Studio</div>
          <div className="flex items-center gap-5">
            <Link href={`/${locale}/privacy`} className="hover:text-white/70 transition-colors">Privacy</Link>
            <Link href={`/${locale}/terms`} className="hover:text-white/70 transition-colors">Terms</Link>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"/>
              All systems honey
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
