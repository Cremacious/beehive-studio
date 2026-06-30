import Link from 'next/link'
import { WelcomeTracker } from './_components/welcome-tracker'
import { reconcileCheckoutSessionAction } from '@/lib/actions/billing.actions'

// Reconciliation hits Stripe + the DB on every load; never cache.
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function WelcomePage({ params, searchParams }: Props) {
  const { locale } = await params
  const { session_id: sessionId } = await searchParams

  // Sync entitlement server-side the moment the user lands here, so premium is
  // active regardless of whether the Stripe webhook is configured/reachable.
  // The webhook remains the backstop for later lifecycle events.
  let synced = false
  if (sessionId) {
    const result = await reconcileCheckoutSessionAction({ sessionId })
    synced = result.success && result.data.premium
  }

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
        {synced ? (
          <p className="text-base text-muted-foreground leading-relaxed">
            Your subscription is active. Time to get back to writing.
          </p>
        ) : (
          <p className="text-base text-muted-foreground leading-relaxed">
            Your payment went through. We are activating your premium access now.
            If a premium feature is still locked, refresh this page in a moment or
            check your{' '}
            <Link
              href={`/${locale}/settings/billing`}
              className="text-brand underline underline-offset-2"
            >
              billing settings
            </Link>
            .
          </p>
        )}
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
