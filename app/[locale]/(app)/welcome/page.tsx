import Link from 'next/link'
import { WelcomeTracker } from './_components/welcome-tracker'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function WelcomePage({ params, searchParams }: Props) {
  const { locale } = await params
  const { session_id: sessionId } = await searchParams

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-8">
      <WelcomeTracker sessionId={sessionId} />
      <div className="text-center max-w-md flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-full inline-flex items-center justify-center"
          style={{
            background: 'oklch(from var(--color-brand) l c h / 0.18)',
            color: 'var(--color-brand)',
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 700,
          }}
          aria-hidden
        >
          ✦
        </div>
        <h1
          className="text-3xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
        >
          Welcome to Premium
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Your subscription is active. Time to get back to writing.
        </p>
        <Link
          href={`/${locale}/studio`}
          className="rounded-md bg-brand text-brand-ink font-semibold px-6 py-3 hover:bg-brand-hover transition-colors mt-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Open the studio
        </Link>
      </div>
    </main>
  )
}
