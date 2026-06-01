'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Archive, CalendarDays, CalendarRange, CalendarClock, Target } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EditGoalModal } from './edit-goal-modal'
import { archiveWordGoalAction, type WordGoalRecord } from '@/lib/actions/hive-word-goals.actions'
import type { WordGoalType } from '@/lib/hive/goal-progress'
import { cn } from '@/lib/utils'

type Props = {
  goal: WordGoalRecord
  progress: number
  canManage: boolean
}

const TYPE_META: Record<WordGoalType, { label: string; icon: typeof CalendarDays; accent: string }> = {
  DAILY: { label: 'Daily', icon: CalendarDays, accent: 'var(--status-revised, var(--color-brand))' },
  WEEKLY: { label: 'Weekly', icon: CalendarRange, accent: 'var(--status-drafting, var(--color-brand))' },
  MONTHLY: { label: 'Monthly', icon: CalendarClock, accent: 'var(--status-final, var(--color-brand))' },
  TOTAL: { label: 'Total', icon: Target, accent: 'var(--color-brand)' },
}

function formatRemaining(endDate: Date | null): string | null {
  if (!endDate) return null
  const ms = endDate.getTime() - Date.now()
  if (ms <= 0) return 'Window closed'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hours}h left`
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

export function GoalCard({ goal, progress, canManage }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const meta = TYPE_META[goal.type]
  const Icon = meta.icon
  const pct = goal.targetWords > 0 ? Math.max(0, (progress / goal.targetWords) * 100) : 0
  const pctClamped = Math.min(100, pct)
  const remaining = formatRemaining(goal.endDate)
  const over = pct > 100

  async function handleArchive() {
    const result = await archiveWordGoalAction(goal.id)
    if (!result.success) {
      toast.error(result.error === 'NOT_AUTHORIZED' ? 'You do not have permission.' : result.error)
      return
    }
    toast.success('Goal archived.')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: `oklch(from ${meta.accent} l c h / 0.18)` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: meta.accent }} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta.accent }}>
              {meta.label}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {progress.toLocaleString()} / {goal.targetWords.toLocaleString()} words
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              aria-label="Edit goal"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmArchive(true)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              aria-label="Archive goal"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="h-2 w-full rounded-full overflow-hidden bg-foreground/10">
          <div
            className={cn(
              'h-full transition-[width] duration-300',
              over && 'animate-pulse',
            )}
            style={{
              width: `${pctClamped}%`,
              background: 'var(--color-brand)',
            }}
            aria-label={`Progress: ${pct.toFixed(0)}%`}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className={cn('font-mono', over && 'text-brand font-semibold')}>{pct.toFixed(0)}%</span>
          {remaining ? <span>{remaining}</span> : <span>No deadline</span>}
        </div>
      </div>

      {goal.endDate && (
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-mono">
          Ends {goal.endDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}

      {canManage && (
        <>
          <EditGoalModal open={editOpen} onOpenChange={setEditOpen} goal={goal} />
          <ConfirmDialog
            open={confirmArchive}
            onOpenChange={setConfirmArchive}
            title={`Archive this ${meta.label} goal?`}
            description="You can still see it in History, but new word logs won't count toward it."
            confirmLabel="Archive goal"
            onConfirm={handleArchive}
          />
        </>
      )}
    </div>
  )
}
