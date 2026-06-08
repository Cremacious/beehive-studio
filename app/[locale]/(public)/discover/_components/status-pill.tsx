import type { SparkStatus } from '@/db/schema/social'

const META: Record<SparkStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Open', cls: 'spark-open' },
  VOTING: { label: 'Voting', cls: 'spark-voting' },
  CLOSED: { label: 'Closed', cls: 'spark-closed' },
}

export function StatusPill({ status }: { status: SparkStatus }) {
  const meta = META[status]
  return (
    <span className={`pill ${meta.cls}`}>
      <span className="dot" />
      {meta.label}
    </span>
  )
}
