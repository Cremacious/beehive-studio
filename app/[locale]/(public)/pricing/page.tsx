import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { stripe } from '@/lib/stripe/client'
import { PlanCard } from './_components/plan-card'

export const revalidate = 3600 // ISR — refresh Stripe prices hourly

type Props = { params: Promise<{ locale: string }> }

export default async function PricingPage({ params }: Props) {
  const { locale } = await params

  // Fetch Stripe prices in parallel.
  let monthly: Awaited<ReturnType<typeof stripe.prices.retrieve>> | null = null
  let annual: Awaited<ReturnType<typeof stripe.prices.retrieve>> | null = null
  let priceError: string | null = null

  try {
    const monthlyId = process.env.STRIPE_PRICE_ID_MONTHLY
    const annualId = process.env.STRIPE_PRICE_ID_ANNUAL
    if (!monthlyId || !annualId) {
      throw new Error('Stripe price IDs are not configured')
    }
    ;[monthly, annual] = await Promise.all([
      stripe.prices.retrieve(monthlyId),
      stripe.prices.retrieve(annualId),
    ])
  } catch (err) {
    priceError = err instanceof Error ? err.message : 'Failed to load pricing'
  }

  const session = await auth.api.getSession({ headers: await headers() })
  const isAuthed = !!session?.user

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 gap-10">
      <header className="text-center max-w-xl flex flex-col gap-3">
        <h1
          className="text-4xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
        >
          Beehive Premium
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Unlimited books. Version history. The full writer&apos;s workshop.
        </p>
      </header>

      {priceError || !monthly || !annual ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-center text-sm text-destructive max-w-md">
          Pricing is temporarily unavailable. Refresh in a moment, or
          <a href="mailto:support@beehive.studio" className="underline ml-1">
            contact support
          </a>
          .
        </div>
      ) : (
        <PlanCard
          locale={locale}
          isAuthed={isAuthed}
          monthly={{
            id: monthly.id,
            amount: monthly.unit_amount ?? 0,
            currency: monthly.currency,
          }}
          annual={{
            id: annual.id,
            amount: annual.unit_amount ?? 0,
            currency: annual.currency,
          }}
        />
      )}
    </main>
  )
}
