'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ErrorFallback } from '@/components/error-fallback'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log the real error for debugging; users only ever see branded copy.
  useEffect(() => {
    console.error('[error boundary]', error)
    if (error?.stack) console.error(error.stack)
  }, [error])

  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'en'

  return (
    <ErrorFallback
      onReset={reset}
      homeHref={`/${locale}`}
      homeLabel="Back to home"
      error={error}
    />
  )
}
