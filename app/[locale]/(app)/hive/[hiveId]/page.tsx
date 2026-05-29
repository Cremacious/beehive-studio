import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default async function HiveDashboardPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { hiveId } = await params
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  const { hive, members } = result.data
  const lastActive = hive.updatedAt

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">Hive</p>
        <h1 className="text-2xl font-medium text-foreground">Welcome to {hive.name}</h1>
        {hive.description && (
          <p className="text-sm text-muted-foreground mt-2">{hive.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Members</p>
          <p className="text-2xl font-medium text-foreground mt-1">{members.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last active</p>
          <p className="text-2xl font-medium text-foreground mt-1">{lastActive ? relTime(lastActive) : '—'}</p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Outline, wiki, annotations, submissions, and the buzz board ship in upcoming phases. Use the left nav to peek at what&apos;s coming.
      </div>
    </div>
  )
}
