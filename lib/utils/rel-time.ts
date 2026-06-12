/**
 * Format a date as a relative time string like "2h ago" / "3d ago" / "just now".
 *
 * Returns "never" for null / undefined input (matches the prior list-card
 * inlined helper semantics used across discover surfaces). Use the
 * canonical helper for any backward-looking "X ago" rendering. Forward-
 * looking countdowns (e.g. spark `timeLeftLabel`) are a different shape
 * and live alongside their consumers.
 */
export function relTime(d: Date | string | null | undefined): string {
  if (!d) return 'never'
  const date = typeof d === 'string' ? new Date(d) : d
  const ms = Date.now() - date.getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d2 = Math.floor(h / 24)
  if (d2 < 30) return `${d2}d ago`
  const mo = Math.floor(d2 / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}
