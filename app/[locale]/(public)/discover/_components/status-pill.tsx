import type { SparkStatus } from '@/db/schema/social'

const META: Record<SparkStatus, { label: string; token: string }> = {
  OPEN: { label: 'Open', token: '--status-success' },
  VOTING: { label: 'Voting', token: '--brand' },
  CLOSED: { label: 'Closed', token: '--canvas-dark-ink-muted' },
}

export function StatusPill({ status }: { status: SparkStatus }) {
  const meta = META[status]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
      style={{
        background: `oklch(from var(${meta.token}) l c h / 0.14)`,
        color: `var(${meta.token})`,
        border: `1px solid oklch(from var(${meta.token}) l c h / 0.3)`,
      }}
    >
      {meta.label}
    </span>
  )
}
