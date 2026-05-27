'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export function OverflowBanner() {
  const params = useParams<{ locale: string }>()
  return (
    <div
      data-slot="overflow-banner"
      className="bg-brand/15 border-b border-brand/40 px-4 py-2 flex items-center justify-between gap-3"
    >
      <p className="text-sm text-foreground">
        This book is read-only because you&apos;re on the free tier.
        Upgrade to keep editing.
      </p>
      <Link
        href={`/${params.locale}/pricing`}
        className="text-xs font-semibold rounded-md bg-brand text-brand-ink px-3 py-1.5 hover:bg-brand-hover transition-colors shrink-0"
      >
        Upgrade
      </Link>
    </div>
  )
}
