'use client'

import Link from 'next/link'
import { AlertTriangle, RotateCw } from 'lucide-react'

type Props = {
  title?: string
  message?: string
  /** Calls the route boundary's reset() to retry the segment. */
  onReset?: () => void
  homeHref: string
  homeLabel?: string
  /** Dev-only: the underlying error, shown as a collapsible detail block. */
  error?: Error & { digest?: string }
}

/**
 * Branded dark-iOS error fallback used by every error boundary. Shows a
 * reassuring message and recovery actions; never leaks the raw error to users
 * (the detail block renders only in development).
 */
export function ErrorFallback({
  title = 'Something went wrong',
  message = 'We hit an unexpected problem. You can try again, or head back to safety.',
  onReset,
  homeHref,
  homeLabel = 'Go home',
  error,
}: Props) {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#262728] px-6">
      <div
        className="w-full max-w-md rounded-[var(--r-card)] p-8 text-center"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: '1px solid var(--br-card)',
        }}
      >
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          <AlertTriangle className="h-6 w-6 text-[var(--brand)]" />
        </div>
        <h1 className="mb-2 font-comfortaa text-xl font-bold text-[var(--brand)]">{title}</h1>
        <p className="mb-6 text-sm text-[var(--canvas-dark-ink)]">{message}</p>

        <div className="flex items-center justify-center gap-3">
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-[var(--r-btn)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
            >
              <RotateCw className="h-4 w-4" />
              Try again
            </button>
          )}
          <Link
            href={homeHref}
            className="inline-block rounded-[var(--r-btn)] px-5 py-2 text-sm font-medium text-[var(--canvas-dark-ink)] hover:text-[var(--canvas-dark-ink-strong)]"
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            {homeLabel}
          </Link>
        </div>

        {isDev && error?.message && (
          <pre className="mt-6 max-h-48 overflow-auto whitespace-pre-wrap rounded-[var(--r-row)] border border-[var(--br-card)] bg-[var(--canvas-dark-100)] p-3 text-left text-[11px] text-[var(--canvas-dark-ink-muted)]">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        )}
      </div>
    </div>
  )
}
