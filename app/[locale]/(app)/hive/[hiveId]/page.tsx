import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getTasksAction } from '@/lib/actions/hive-content.actions'
import { HiveOverview } from './_components/hive-overview'

export default async function HivePage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params

  const [hiveResult, tasksResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getTasksAction(hiveId).catch(() => ({ success: true as const, data: [] })),
  ])

  if (!hiveResult?.success) notFound()

  return (
    <HiveOverview
      hive={hiveResult.data.hive}
      members={hiveResult.data.members}
      tasks={tasksResult?.success ? tasksResult.data : []}
      isOwner={hiveResult.data.isOwner}
      locale={locale}
    />
  )
}
