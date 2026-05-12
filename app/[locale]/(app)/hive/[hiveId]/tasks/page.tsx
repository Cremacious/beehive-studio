import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getTasksAction } from '@/lib/actions/hive-content.actions'
import { HiveTasks } from '../_components/hive-tasks'

export default async function HiveTasksPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const [hiveResult, tasksResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getTasksAction(hiveId).catch(() => null),
  ])
  if (!hiveResult?.success) notFound()
  return (
    <HiveTasks
      hiveId={hiveId}
      initialTasks={tasksResult?.success ? tasksResult.data : []}
      members={hiveResult.data.members}
      currentUserId={session!.user.id}
    />
  )
}
