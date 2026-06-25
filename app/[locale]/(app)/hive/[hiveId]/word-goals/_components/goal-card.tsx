'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreVertical, Pencil, Archive } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditGoalModal } from './edit-goal-modal'
import { archiveWordGoalAction, type WordGoalRecord } from '@/lib/actions/hive-word-goals.actions'
import { toastNetworkError } from '@/lib/errors/notify'
import type { WordGoalType } from '@/lib/hive/goal-progress'
import { HivePill } from '../../_components/hive-pill'

type Props = {
  goal: WordGoalRecord
  progress: number
  canManage: boolean
}

const GOAL_TOKEN: Record<WordGoalType, string> = {
  DAILY: '--goal-daily',
  WEEKLY: '--goal-weekly',
  MONTHLY: '--goal-monthly',
  TOTAL: '--goal-custom',
}

const TYPE_LABEL: Record<WordGoalType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  TOTAL: 'Total',
}

function formatRemaining(endDate: Date | null): string | null {
  if (!endDate) return null
  const ms = endDate.getTime() - Date.now()
  if (ms <= 0) return 'Window closed'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`
  if (hours > 0) return `${hours}h left`
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return `${minutes}m left`
}

export function GoalCard({ goal, progress, canManage }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const token = GOAL_TOKEN[goal.type]
  const label = TYPE_LABEL[goal.type]
  const pct = goal.targetWords > 0 ? Math.max(0, (progress / goal.targetWords) * 100) : 0
  const pctClamped = Math.min(100, pct)
  const remaining = formatRemaining(goal.endDate)

  async function handleArchive() {
    try {
      const result = await archiveWordGoalAction(goal.id)
      if (!result.success) {
        toast.error(result.error === 'NOT_AUTHORIZED' ? 'You do not have permission.' : result.error)
        return
      }
      toast.success('Goal archived.')
      router.refresh()
    } catch {
      toastNetworkError()
    }
  }

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
        padding: '18px',
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="font-comfortaa font-bold"
          style={{
            color: 'var(--canvas-dark-ink-strong)',
            fontSize: '17px',
          }}
        >
          {`${label} goal`}
        </span>
        <HivePill token={token}>{label}</HivePill>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Goal options"
                className="ml-auto inline-flex items-center justify-center rounded-md p-1 text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)] hover:bg-[var(--canvas-dark-100)]"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit goal
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmArchive(true)}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        style={{
          height: '8px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          overflow: 'hidden',
        }}
      >
        <div
          className="transition-[width] duration-300"
          style={{
            width: `${pctClamped}%`,
            height: '100%',
            background: 'var(--brand)',
            borderRadius: 'var(--r-pill)',
            boxShadow: '0 0 12px oklch(from var(--brand) l c h / 0.4)',
          }}
          aria-label={`Progress: ${pct.toFixed(0)}%`}
        />
      </div>

      <div
        className="flex items-center justify-between mt-3"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        <span>
          <b
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--canvas-dark-ink-strong)',
              fontWeight: 700,
            }}
          >
            {progress.toLocaleString()}
          </b>{' '}
          / {goal.targetWords.toLocaleString()} words
        </span>
        {remaining ? (
          <span>{remaining}</span>
        ) : goal.endDate ? (
          <span>
            Ends{' '}
            {goal.endDate.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        ) : (
          <span>No deadline</span>
        )}
      </div>

      {canManage && (
        <>
          <EditGoalModal open={editOpen} onOpenChange={setEditOpen} goal={goal} />
          <ConfirmDialog
            open={confirmArchive}
            onOpenChange={setConfirmArchive}
            title={`Archive this ${label} goal?`}
            description="You can still see it in History, but new word logs won't count toward it."
            confirmLabel="Archive goal"
            onConfirm={handleArchive}
          />
        </>
      )}
    </div>
  )
}
