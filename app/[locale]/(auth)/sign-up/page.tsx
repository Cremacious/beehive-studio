import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { safeNextPath } from '@/lib/utils'
import { SignUpForm } from './_components/sign-up-form'
import { BeehiveMark } from '@/components/brand/beehive-mark'

export const metadata = { title: 'Join the hive' }

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string }>
}

export default async function SignUpPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { next: rawNext } = await searchParams

  // Already-signed-in users have no reason to be on the sign-up page.
  // Honor ?next= if provided (e.g., they followed an Upgrade link while
  // already authed); otherwise send them to the studio.
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    const next = safeNextPath(rawNext ?? null, `/${locale}/studio`)
    redirect(next)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse 80% 55% at 50% 0%, oklch(from var(--brand) l c h / 0.07), transparent 60%), #262728', color: 'var(--canvas-dark-ink-strong, #fff)' }}
    >
      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <BeehiveMark className="h-6 w-auto" />
            <span
              className="mainFont font-bold text-[17px] tracking-tight"
              style={{ color: 'var(--canvas-dark-ink-strong)' }}
            >
              Beehive Books
            </span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <SignUpForm locale={locale} />
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6">
        <div
          className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-[12px]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <div>© 2026 Beehive Books</div>
          <div className="flex items-center gap-5">
            <Link href={`/${locale}/privacy`} className="hover:opacity-80 transition-opacity">Privacy</Link>
            <Link href={`/${locale}/terms`} className="hover:opacity-80 transition-opacity">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
