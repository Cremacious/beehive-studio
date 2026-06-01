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

export async function ActiveGoalsStrip({ hiveId, goals, canManage }: Props) {
  const active = goals.filter((g) => g.isActive)
  const byType = new Map<WordGoalType, WordGoalRecord>()
  for (const g of active) byType.set(g.type, g)

  // Fetch progress for each active goal in parallel
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
    <section>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                background: 'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-200))',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-tile)',
                border: '1px dashed oklch(1 0 0 / 0.08)',
              }}
              className="p-4 flex flex-col items-start gap-2"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--canvas-dark-ink-muted)]">
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </div>
              <p className="text-xs text-[var(--canvas-dark-ink-muted)]">
                No active {type.toLowerCase()} goal.
              </p>
              <NewGoalModal
                hiveId={hiveId}
                existingActiveTypes={activeTypes}
                triggerLabel={`+ Add ${type.charAt(0) + type.slice(1).toLowerCase()} Goal`}
                triggerClassName="!px-2 !py-1 !text-xs"
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
