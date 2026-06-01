import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canSetWordGoal } from '@/lib/hive/permissions'
import {
  listHiveWordGoalsAction,
  getWordGoalProgressAction,
} from '@/lib/actions/hive-word-goals.actions'
import { getRecentWordLogsAction } from '@/lib/actions/hive-word-logs.actions'
import { pickPrimaryActiveGoal } from '@/lib/hive/goal-progress'
import { ActiveGoalsStrip } from './_components/active-goals-strip'
import { ContributorsPanel } from './_components/contributors-panel'
import { RecentActivityPanel } from './_components/recent-activity-panel'
import { GoalHistory } from './_components/goal-history'
import { EmptyState } from './_components/empty-state'
import { NewGoalModal } from './_components/new-goal-modal'

export default async function WordGoalsPage({
  params,
}: {
  params: Promise<{ locale: string; hiveId: string }>
}) {
  const { locale, hiveId } = await params
  const userId = await requireAuth()

  let role
  try {
    role = await requireHiveMember(hiveId, userId)
  } catch {
    notFound()
  }

  const [goalsRes, logsRes] = await Promise.all([
    listHiveWordGoalsAction(hiveId),
    getRecentWordLogsAction({ hiveId, limit: 20 }),
  ])
  if (!goalsRes.success) notFound()
  const goals = goalsRes.data
  const activeGoals = goals.filter((g) => g.isActive)
  const archivedGoals = goals.filter((g) => !g.isActive)
  const primaryRow = pickPrimaryActiveGoal(activeGoals)
  const primary = primaryRow ? activeGoals.find((g) => g.id === primaryRow.id) ?? null : null
  const primaryProgressRes = primary
    ? await getWordGoalProgressAction({ goalId: primary.id })
    : null
  const primaryProgress =
    primaryProgressRes && primaryProgressRes.success ? primaryProgressRes.data : null

  const canManage = canSetWordGoal(role)
  const activeTypes = activeGoals.map((g) => g.type)
  const recentItems = logsRes.success ? logsRes.data.items : []
  const recentCursor = logsRes.success ? logsRes.data.nextCursor : null

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-comfortaa font-bold text-2xl text-foreground">Word Goals</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Set a shared writing target. Word logs from the hive roll up against it.
            </p>
          </div>
          {canManage && activeGoals.length > 0 && activeGoals.length < 4 && (
            <NewGoalModal hiveId={hiveId} existingActiveTypes={activeTypes} />
          )}
        </header>

        {activeGoals.length === 0 ? (
          <EmptyState hiveId={hiveId} canCreate={canManage} existingActiveTypes={activeTypes} />
        ) : (
          <div className="space-y-6">
            <ActiveGoalsStrip hiveId={hiveId} goals={goals} canManage={canManage} />
            {primary && primaryProgress && (
              <ContributorsPanel
                primary={primary}
                contributors={primaryProgress.contributors}
                totalProgress={primaryProgress.progress}
                locale={locale}
              />
            )}
            <RecentActivityPanel
              hiveId={hiveId}
              initialItems={recentItems}
              initialCursor={recentCursor}
              locale={locale}
            />
          </div>
        )}

        <div className="mt-6">
          <GoalHistory archived={archivedGoals} />
        </div>
      </div>
    </main>
  )
}
