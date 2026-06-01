'use client'

import { Target } from 'lucide-react'
import { NewGoalModal } from './new-goal-modal'

type Props = {
  hiveId: string
  canCreate: boolean
  existingActiveTypes: ReadonlyArray<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TOTAL'>
}

export function EmptyState({ hiveId, canCreate, existingActiveTypes }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 flex flex-col items-center text-center gap-3">
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center"
        style={{ background: 'oklch(from var(--color-brand) l c h / 0.15)' }}
      >
        <Target className="w-6 h-6 text-brand" />
      </div>
      <div>
        <h3 className="font-comfortaa font-bold text-base text-foreground">
          No active goals
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Word goals rally the hive around a shared writing target. Daily, weekly,
          monthly, or a single push to a total word count.
        </p>
      </div>
      {canCreate ? (
        <div className="mt-2">
          <NewGoalModal
            hiveId={hiveId}
            existingActiveTypes={existingActiveTypes}
            triggerLabel="+ New Goal"
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">
          Only owners and moderators can set goals.
        </p>
      )}
    </div>
  )
}
