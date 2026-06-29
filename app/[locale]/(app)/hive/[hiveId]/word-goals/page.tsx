import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canSetWordGoal } from '@/lib/hive/permissions'
import {
  listHiveWordGoalsAction,
  getWordGoalProgressAction,
} from '@/lib/actions/hive-word-goals.actions'
import { getRecentWordLogsAction } from '@/lib/actions/hive-word-logs.actions'
import { pickPrimaryActiveGoal } from '@/lib/hive/goal-progress'
import { HivePageShell } from '../_components/hive-page-shell'
import { HiveSectionDivider } from '../_components/hive-section-divider'
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

  const canShowHeaderCTA = canManage && activeGoals.length < 4

  return (
    <HivePageShell
      width="standard"
      mobileBleed
      title="Word Goals"
      subtitle="Set a shared writing target with your hive."
      headerSlot={
        canShowHeaderCTA ? (
          <NewGoalModal
            hiveId={hiveId}
            existingActiveTypes={activeTypes}
            triggerLabel="+ New Goal"
            triggerClassName="!px-4 !py-2 !text-[13px] !rounded-[var(--r-pill)] max-md:!w-full max-md:!justify-center max-md:!min-h-[42px]"
          />
        ) : undefined
      }
    >
      {activeGoals.length === 0 ? (
        <div className="px-6 pb-6 max-md:px-3">
          <EmptyState
            hiveId={hiveId}
            canCreate={canManage}
            existingActiveTypes={activeTypes}
          />
          {archivedGoals.length > 0 && (
            <HiveSectionDivider label="History">
              <GoalHistory archived={archivedGoals} />
            </HiveSectionDivider>
          )}
        </div>
      ) : (
        <>
          <HiveSectionDivider label="Active goals" hideTopBorder>
            <ActiveGoalsStrip hiveId={hiveId} goals={goals} canManage={canManage} />
          </HiveSectionDivider>
          {primary && primaryProgress && (
            <HiveSectionDivider
              label={`Contributors · ${
                primary.type.charAt(0) + primary.type.slice(1).toLowerCase()
              } goal`}
            >
              <ContributorsPanel
                primary={primary}
                contributors={primaryProgress.contributors}
                totalProgress={primaryProgress.progress}
                locale={locale}
              />
            </HiveSectionDivider>
          )}
          <HiveSectionDivider label="Recent activity">
            <RecentActivityPanel
              hiveId={hiveId}
              initialItems={recentItems}
              initialCursor={recentCursor}
              locale={locale}
            />
          </HiveSectionDivider>
          {archivedGoals.length > 0 && (
            <HiveSectionDivider label="History">
              <GoalHistory archived={archivedGoals} />
            </HiveSectionDivider>
          )}
        </>
      )}
    </HivePageShell>
  )
}
