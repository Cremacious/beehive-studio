'use client'

import { useEffect } from 'react'
import { ErrorFallback } from '@/components/error-fallback'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin error boundary]', error)
    if (error?.stack) console.error(error.stack)
  }, [error])

  return (
    <ErrorFallback
      onReset={reset}
      homeHref="/admin"
      homeLabel="Back to admin"
      error={error}
    />
  )
}
