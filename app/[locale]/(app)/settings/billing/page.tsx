import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ManageButton } from './_components/manage-button'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }> }

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function BillingPage({ params }: Props) {
  const { locale } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect(`/${locale}/sign-in?next=/${locale}/settings/billing`)
  }

  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, session.user.id),
    columns: {
      subscriptionStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  })

  const status = billing?.subscriptionStatus ?? null

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
          Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Subscription status updates may take a few seconds to reflect changes from Stripe.
        </p>
      </header>

      {/* Free tier — no userBilling row, or no subscription */}
      {!status && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground">You&apos;re on the free tier</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Up to 3 books, 3 Hives, and full community access. Upgrade for unlimited everything, version history, and publishing details.
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-block mt-4 rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:bg-brand-hover transition-colors"
          >
            See Premium
          </Link>
        </section>
      )}

      {/* Active / trialing — hero status */}
      {(status === 'active' || status === 'trialing') && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            You&apos;re on Premium
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {status === 'trialing' ? 'Free trial' : 'Active subscription'}
            {billing?.currentPeriodEnd && <> · renews {formatDate(new Date(billing.currentPeriodEnd))}</>}
          </p>
          <ManageButton locale={locale} className="mt-6" />
        </section>
      )}

      {/* past_due — warning */}
      {status === 'past_due' && (
        <section
          className="bg-card border-2 rounded-lg p-6"
          style={{ borderColor: 'color-mix(in oklch, var(--warning) 45%, transparent)' }}
        >
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Payment failed
          </h2>
          <p className="text-sm text-foreground mt-1 leading-relaxed">
            Your last payment didn&apos;t go through. Stripe is retrying. Update your card in the next few weeks to keep premium access.
          </p>
          <ManageButton locale={locale} className="mt-6" />
        </section>
      )}

      {/* Canceled — show end date + re-subscribe */}
      {status === 'canceled' && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground">Your subscription ended</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {billing?.currentPeriodEnd && <>Ended on {formatDate(new Date(billing.currentPeriodEnd))}. </>}
            You&apos;re on the free tier now.
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-block mt-4 rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:bg-brand-hover transition-colors"
          >
            Resubscribe
          </Link>
        </section>
      )}

      {/* Other statuses (incomplete, unpaid, paused) — generic */}
      {status && !['active', 'trialing', 'past_due', 'canceled'].includes(status) && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground">Subscription status: {status}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your subscription via Stripe to resolve this status.
          </p>
          <ManageButton locale={locale} className="mt-6" />
        </section>
      )}
    </main>
  )
}
