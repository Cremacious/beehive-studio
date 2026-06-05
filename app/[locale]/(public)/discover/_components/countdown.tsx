'use client'

import { useEffect, useState } from 'react'

export function Countdown({ to, prefix }: { to: Date | string; prefix: string }) {
  const target = typeof to === 'string' ? new Date(to) : to
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return null

  const days = Math.floor(diffMs / (24 * 3600_000))
  const hours = Math.floor(diffMs / 3600_000)
  const minutes = Math.floor(diffMs / 60_000)

  const label = days >= 1 ? `${days}d` : hours >= 1 ? `${hours}h` : `${minutes}m`

  return (
    <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
      {prefix} {label}
    </span>
  )
}
