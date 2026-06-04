import { GoalCard } from './goal-card'
import { NewGoalModal } from './new-goal-modal'
import { getWordGoalProgressAction, type WordGoalRecord } from '@/lib/actions/hive-word-goals.actions'
import type { WordGoalType } from '@/lib/hive/goal-progress'

type Props = {
  hiveId: string
  goals: WordGoalRecord[]
  canManage: boolean
}

const ORDER: WordGoalType[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'TOTAL']
const TYPE_LABEL: Record<WordGoalType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  TOTAL: 'Total',
}

export async function ActiveGoalsStrip({ hiveId, goals, canManage }: Props) {
  const active = goals.filter((g) => g.isActive)
  const byType = new Map<WordGoalType, WordGoalRecord>()
  for (const g of active) byType.set(g.type, g)

  // Fetch progress for active goals in parallel (preserves existing data flow)
  const progressList = await Promise.all(
    ORDER.map(async (type) => {
      const goal = byType.get(type)
      if (!goal) return null
      const res = await getWordGoalProgressAction({ goalId: goal.id })
      const progress = res.success ? res.data.progress : 0
      return { goal, progress }
    }),
  )

  const activeTypes = active.map((g) => g.type)

  return (
    <div className="flex flex-col gap-3">
      {ORDER.map((type, i) => {
        const entry = progressList[i]
        if (entry) {
          return (
            <GoalCard
              key={type}
              goal={entry.goal}
              progress={entry.progress}
              canManage={canManage}
            />
          )
        }
        if (!canManage) return null
        return (
          <div
            key={type}
            style={{
              background:
                'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-200))',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-tile)',
              border: '1px dashed oklch(1 0 0 / 0.08)',
              padding: '14px 18px',
            }}
            className="flex items-center justify-between gap-3"
          >
            <p className="text-xs text-[var(--canvas-dark-ink-muted)]">
              No active {TYPE_LABEL[type]} goal.
            </p>
            <NewGoalModal
              hiveId={hiveId}
              existingActiveTypes={activeTypes}
              triggerLabel={`+ Add ${TYPE_LABEL[type]} Goal`}
              triggerClassName="!px-3 !py-1.5 !text-xs"
            />
          </div>
        )
      })}
    </div>
  )
}
