import { requireAuth } from '@/lib/require-auth'
import { RedeemForm } from './redeem-form'

export const dynamic = 'force-dynamic'

export default async function RedeemPage() {
  await requireAuth()

  return (
    <main className="page-x tier-narrow py-12">
      <div
        className="rounded-[var(--r-card)] p-7"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: 'var(--br-card)',
        }}
      >
        <h1
          className="font-bold text-2xl"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Redeem a code
        </h1>
        <p
          className="text-sm mt-1 mb-6"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Got a promo code? Enter it below to unlock premium.
        </p>
        <RedeemForm />
      </div>
    </main>
  )
}
