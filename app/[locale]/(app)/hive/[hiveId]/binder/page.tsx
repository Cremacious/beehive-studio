import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { getHiveChapterLocksAction } from '@/lib/actions/hive-collab.actions'
import { HiveBinder } from '../_components/hive-binder'

export default async function HiveBinderPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale: _locale, hiveId } = await params

  const [hiveResult, locksResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getHiveChapterLocksAction(hiveId).catch(() => ({ success: true as const, data: {} as Record<string, { userId: string; lockedAt: Date }> })),
  ])

  if (!hiveResult?.success) notFound()
  const { hive } = hiveResult.data
  if (!hive.bookId) return <div className="p-8 text-sm text-muted-foreground">No book linked to this Hive.</div>

  const binderResult = await getBinderTreeAction(hive.bookId).catch(() => null)
  if (!binderResult?.success) notFound()

  return (
    <HiveBinder
      hiveId={hiveId}
      bookId={hive.bookId}
      initialBinderItems={binderResult.data}
      initialLocks={locksResult?.success ? locksResult.data : {}}
      members={hiveResult.data.members}
    />
  )
}
