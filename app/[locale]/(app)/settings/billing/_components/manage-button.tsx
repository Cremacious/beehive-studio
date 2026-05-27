'use client'

import { useState } from 'react'
import { createBillingPortalSessionAction } from '@/lib/actions/billing.actions'
import { cn } from '@/lib/utils'

type Props = { locale: string; className?: string }

export function ManageButton({ locale, className }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (loading) return
    setError(null)
    setLoading(true)
    const result = await createBillingPortalSessionAction({ locale })
    if (result.success) {
      window.location.href = result.data.url
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:bg-brand-hover transition-colors disabled:opacity-50',
          className,
        )}
      >
        {loading ? 'Opening…' : 'Manage subscription'}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
