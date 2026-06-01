'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateWordGoalAction } from '@/lib/actions/hive-word-goals.actions'
import type { WordGoalType } from '@/lib/hive/goal-progress'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: {
    id: string
    type: WordGoalType
    targetWords: number
    startDate: Date
    endDate: Date | null
  }
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EditGoalModal({ open, onOpenChange, goal }: Props) {
  const router = useRouter()
  const [targetWords, setTargetWords] = useState(String(goal.targetWords))
  const [endStr, setEndStr] = useState(goal.endDate ? toLocalInputValue(goal.endDate) : '')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    const n = Number(targetWords)
    if (!Number.isFinite(n) || n < 1) {
      toast.error('Target words must be at least 1.')
      return
    }
    setPending(true)
    try {
      const end = endStr ? new Date(endStr) : goal.type === 'TOTAL' ? null : null
      const result = await updateWordGoalAction({
        id: goal.id,
        targetWords: Math.floor(n),
        endDate: end,
      })
      if (!result.success) {
        toast.error(result.error === 'NOT_AUTHORIZED' ? 'You do not have permission.' : result.error)
        return
      }
      toast.success('Goal updated.')
      onOpenChange(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Word Goal</DialogTitle>
          <DialogDescription>
            Type and start date are locked. Adjust the target or end date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
              <div className="mt-2 text-sm text-foreground">{goal.type}</div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Started</Label>
              <div className="mt-2 text-sm text-foreground">
                {goal.startDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="targetWordsEdit" className="text-xs uppercase tracking-wide text-muted-foreground">
              Target words
            </Label>
            <Input
              id="targetWordsEdit"
              type="number"
              min={1}
              max={10_000_000}
              value={targetWords}
              onChange={(e) => setTargetWords(e.target.value)}
              className="mt-2"
              required
            />
          </div>

          <div>
            <Label htmlFor="endDateEdit" className="text-xs uppercase tracking-wide text-muted-foreground">
              End {goal.type === 'TOTAL' && <span className="normal-case text-[10px]">(optional)</span>}
            </Label>
            <Input
              id="endDateEdit"
              type="datetime-local"
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              className="mt-2"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-brand text-brand-ink hover:bg-brand-hover"
            >
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
