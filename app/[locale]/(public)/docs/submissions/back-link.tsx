'use client'

import { useRouter } from 'next/navigation'

/**
 * Client-side back link. Uses router.back() so we return to wherever the
 * reader came from (the hive submissions page in the canonical flow, but
 * works from any caller).
 */
export function BackLink() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 mb-6 text-[12.5px] font-medium font-mono uppercase tracking-wider"
      style={{ color: 'var(--canvas-dark-ink-muted)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--brand)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--canvas-dark-ink-muted)'
      }}
    >
      ← Back
    </button>
  )
}
