import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ManageButton } from './_components/manage-button'
import { CreditCard, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Billing · Settings' }

type Props = { params: Promise<{ locale: string }> }

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active' || status === 'trialing') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[999px] text-[11px] font-mono uppercase tracking-wider"
        style={{ background: 'oklch(0.65 0.15 150 / 0.15)', color: 'oklch(0.75 0.15 150)' }}
      >
        <CheckCircle2 size={11} />
        {status === 'trialing' ? 'Trial' : 'Active'}
      </span>
    )
  }
  if (status === 'past_due') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[999px] text-[11px] font-mono uppercase tracking-wider"
        style={{ background: 'oklch(0.72 0.15 65 / 0.15)', color: 'oklch(0.80 0.14 65)' }}
      >
        <AlertTriangle size={11} />
        Past due
      </span>
    )
  }
  if (status === 'canceled') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[999px] text-[11px] font-mono uppercase tracking-wider"
        style={{ background: 'oklch(1 0 0 / 0.05)', color: 'var(--canvas-dark-ink-muted)' }}
      >
        <XCircle size={11} />
        Canceled
      </span>
    )
  }
  return null
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
    <>
      <header className="mb-6">
        <h1
          className="text-[22px] font-bold"
          style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
        >
          Billing
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Manage your subscription. Status updates may take a few seconds to reflect Stripe changes.
        </p>
      </header>

      {/* Free tier */}
      {!status && (
        <section
          className="rounded-[20px] p-6"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--brand-soft)' }}
            >
              <CreditCard size={18} style={{ color: 'var(--brand)' }} />
            </div>
            <div>
              <h2
                className="font-bold text-[16px]"
                style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
              >
                Free tier
              </h2>
              <p className="text-[12.5px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                Up to 3 books, 3 Hives, full community access
              </p>
            </div>
          </div>
          <p className="text-[13.5px] leading-relaxed mb-5" style={{ color: 'var(--canvas-dark-ink)' }}>
            Upgrade to Premium for unlimited books, version history, publishing details, and more.
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-[12px] no-underline transition-all hover:-translate-y-px"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)', fontFamily: 'var(--font-display)' }}
          >
            See Premium plans
          </Link>
        </section>
      )}

      {/* Active / trialing */}
      {(status === 'active' || status === 'trialing') && (
        <section
          className="rounded-[20px] p-6"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2
                className="font-bold text-[18px]"
                style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
              >
                Beehive Premium
              </h2>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                {status === 'trialing' ? 'Free trial' : 'Active subscription'}
                {billing?.currentPeriodEnd && (
                  <> &middot; renews {formatDate(new Date(billing.currentPeriodEnd))}</>
                )}
              </p>
            </div>
            <StatusBadge status={status} />
          </div>
          <ManageButton locale={locale} />
        </section>
      )}

      {/* Past due */}
      {status === 'past_due' && (
        <section
          className="rounded-[20px] p-6"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
            border: '1px solid oklch(0.72 0.15 65 / 0.35)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2
                className="font-bold text-[18px]"
                style={{ color: 'oklch(0.80 0.14 65)', fontFamily: 'var(--font-display)' }}
              >
                Payment failed
              </h2>
              <p className="text-[13px] mt-0.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                Your last payment did not go through. Stripe is retrying. Update your card to keep access.
              </p>
            </div>
            <StatusBadge status={status} />
          </div>
          <ManageButton locale={locale} />
        </section>
      )}

      {/* Canceled */}
      {status === 'canceled' && (
        <section
          className="rounded-[20px] p-6"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2
                className="font-bold text-[16px]"
                style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
              >
                Subscription ended
              </h2>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                {billing?.currentPeriodEnd && <>Ended {formatDate(new Date(billing.currentPeriodEnd))}. </>}
                You are on the free tier.
              </p>
            </div>
            <StatusBadge status={status} />
          </div>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-[12px] no-underline transition-all hover:-translate-y-px"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)', fontFamily: 'var(--font-display)' }}
          >
            Resubscribe
          </Link>
        </section>
      )}

      {/* Other statuses */}
      {status && !['active', 'trialing', 'past_due', 'canceled'].includes(status) && (
        <section
          className="rounded-[20px] p-6"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <h2
            className="font-bold text-[16px] mb-2"
            style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
          >
            Subscription status: {status}
          </h2>
          <p className="text-[13.5px] mb-4" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Manage your subscription via Stripe to resolve this status.
          </p>
          <ManageButton locale={locale} />
        </section>
      )}
    </>
  )
}
