import type { SparkStatus } from '@/lib/actions/discover-sparks.actions'

export function timeLeftLabel(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return 'Just now'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

export function statusToken(status: SparkStatus): string {
  if (status === 'OPEN') return 'var(--spark-status-open)'
  if (status === 'VOTING') return 'var(--brand)'
  return 'var(--canvas-dark-ink-muted)'
}

export function statusLabel(status: SparkStatus): string {
  if (status === 'OPEN') return 'Open'
  if (status === 'VOTING') return 'Voting'
  return 'Closed'
}
