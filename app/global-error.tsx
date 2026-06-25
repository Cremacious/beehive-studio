'use client'

import { useEffect } from 'react'
import './globals.css'

/**
 * Root-level error boundary. Renders when the error happens above the locale
 * layout (so it must supply its own <html>/<body>). Kept dependency-light and
 * self-contained: no next/font vars are available here, so we rely on
 * globals.css :root tokens and a system font fallback.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error boundary]', error)
    if (error?.stack) console.error(error.stack)
  }, [error])

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#262728',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '28rem',
            borderRadius: 'var(--r-card, 20px)',
            padding: '2rem',
            textAlign: 'center',
            background: 'linear-gradient(180deg, var(--canvas-dark-250, #2f3032), var(--canvas-dark-200, #262728))',
            boxShadow: 'var(--sh-card, 0 12px 32px rgba(0,0,0,0.4))',
            borderTop: '1px solid var(--br-card, rgba(255,255,255,0.06))',
            color: 'var(--canvas-dark-ink, #d6d3cd)',
          }}
        >
          <h1
            style={{
              margin: '0 0 0.5rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--brand, #FFC300)',
            }}
          >
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem' }}>
            We hit an unexpected problem. Please try again.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                cursor: 'pointer',
                borderRadius: 'var(--r-btn, 12px)',
                border: 'none',
                background: 'var(--brand, #FFC300)',
                color: 'var(--brand-ink, #1a1300)',
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: 'var(--r-btn, 12px)',
                background: 'linear-gradient(180deg, var(--canvas-dark-350, #3a3b3d), var(--canvas-dark-300, #303133))',
                color: 'var(--canvas-dark-ink, #d6d3cd)',
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
