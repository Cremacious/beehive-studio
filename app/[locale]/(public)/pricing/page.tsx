import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getPricingData } from '@/lib/upgrade/pricing-data'
import { PlanCard } from './_components/plan-card'

export const revalidate = 3600 // ISR — refresh Stripe prices hourly

type Props = { params: Promise<{ locale: string }> }

export default async function PricingPage({ params }: Props) {
  const { locale } = await params

  const pricing = await getPricingData()

  const session = await auth.api.getSession({ headers: await headers() })
  const isAuthed = !!session?.user

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-16 gap-10">
      <header className="text-center max-w-xl flex flex-col gap-3">
        <span
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--brand)',
          }}
        >
          Simple, honest pricing
        </span>
        <h1
          className="text-4xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--brand)', letterSpacing: '-0.02em' }}
        >
          Write more. Worry less.
        </h1>
        <p className="text-base leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Start free. Upgrade when your writing demands it.
        </p>
      </header>

      {!pricing.ok ? (
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
          monthly={pricing.monthly}
          annual={pricing.annual}
          savingsPct={pricing.savingsPct}
        />
      )}
    </main>
  )
}
