'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { syncMyBillingFromStripeAction } from '@/lib/actions/billing.actions'

/**
 * Fallback for when a Stripe change (upgrade, cancel, resubscribe) did not reach
 * the app via webhook — pulls the latest subscription from Stripe and re-syncs
 * userBilling, then refreshes the page. Most useful in local dev without
 * `stripe listen`, but harmless anywhere.
 */
export function RefreshStatusButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (loading) return
    setError(null)
    setLoading(true)
    const result = await syncMyBillingFromStripeAction()
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 self-start text-[12px] transition-opacity disabled:opacity-50 hover:opacity-80"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
        {loading ? 'Syncing with Stripe…' : 'Refresh status from Stripe'}
      </button>
      {error && (
        <p className="text-[11px]" style={{ color: 'var(--destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
