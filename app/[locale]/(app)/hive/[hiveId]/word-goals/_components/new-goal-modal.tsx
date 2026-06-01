'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, CalendarDays, CalendarRange, CalendarClock, Target } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createWordGoalAction } from '@/lib/actions/hive-word-goals.actions'
import { computeGoalEndDate, type WordGoalType } from '@/lib/hive/goal-progress'

type Props = {
  hiveId: string
  existingActiveTypes: ReadonlyArray<WordGoalType>
  triggerLabel?: string
  triggerClassName?: string
}

const TYPE_OPTIONS: Array<{
  value: WordGoalType
  label: string
  desc: string
  icon: typeof CalendarDays
}> = [
  { value: 'DAILY', label: 'Daily', desc: '24h push', icon: CalendarDays },
  { value: 'WEEKLY', label: 'Weekly', desc: '7-day window', icon: CalendarRange },
  { value: 'MONTHLY', label: 'Monthly', desc: '30-day window', icon: CalendarClock },
  { value: 'TOTAL', label: 'Total', desc: 'No deadline', icon: Target },
]

function toLocalInputValue(d: Date): string {
  // YYYY-MM-DDTHH:mm in local time, suitable for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function NewGoalModal({
  hiveId,
  existingActiveTypes,
  triggerLabel = '+ New Goal',
  triggerClassName,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const taken = new Set(existingActiveTypes)
  const firstFree = TYPE_OPTIONS.find((t) => !taken.has(t.value))?.value ?? 'DAILY'

  const [type, setType] = useState<WordGoalType>(firstFree)
  const [targetWords, setTargetWords] = useState('1000')
  const now = new Date()
  const [startStr, setStartStr] = useState(toLocalInputValue(now))
  const [endStr, setEndStr] = useState(() => {
    const d = computeGoalEndDate(firstFree, now)
    return d ? toLocalInputValue(d) : ''
  })
  const [pending, setPending] = useState(false)

  function handleTypeChange(next: WordGoalType) {
    if (taken.has(next)) return
    setType(next)
    const start = startStr ? new Date(startStr) : new Date()
    if (next === 'TOTAL') {
      setEndStr('')
    } else {
      const d = computeGoalEndDate(next, start)
      setEndStr(d ? toLocalInputValue(d) : '')
    }
  }

  function handleStartChange(v: string) {
    setStartStr(v)
    if (type !== 'TOTAL' && v) {
      const d = computeGoalEndDate(type, new Date(v))
      if (d) setEndStr(toLocalInputValue(d))
    }
  }

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
      const start = startStr ? new Date(startStr) : new Date()
      const end = type === 'TOTAL' ? (endStr ? new Date(endStr) : null) : endStr ? new Date(endStr) : null
      const result = await createWordGoalAction({
        hiveId,
        type,
        targetWords: Math.floor(n),
        startDate: start,
        endDate: end,
      })
      if (!result.success) {
        if (result.error === 'GOAL_ALREADY_ACTIVE') {
          toast.error('Another goal of this type is already active.')
        } else if (result.error === 'NOT_AUTHORIZED') {
          toast.error('You do not have permission to set goals.')
        } else {
          toast.error(result.error)
        }
        return
      }
      toast.success(`${TYPE_OPTIONS.find((t) => t.value === type)?.label} goal created.`)
      setOpen(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold',
            triggerClassName,
          )}
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink, oklch(0.18 0.02 60))',
            borderRadius: 'var(--r-btn)',
          }}
        >
          <Plus size={14} />
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New Word Goal</DialogTitle>
          <DialogDescription>
            Pick a cadence and a target. The hive's word logs will roll up against it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(({ value, label, desc, icon: Icon }) => {
                const disabled = taken.has(value)
                const active = type === value
                return (
                  <button
                    type="button"
                    key={value}
                    disabled={disabled}
                    onClick={() => handleTypeChange(value)}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border p-3 text-left transition-colors',
                      active
                        ? 'border-brand bg-brand/10'
                        : 'border-border bg-card hover:border-foreground/30',
                      disabled && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <Icon className={cn('w-4 h-4 mt-0.5', active ? 'text-brand' : 'text-muted-foreground')} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{label}</div>
                      <div className="text-xs text-muted-foreground">
                        {disabled ? 'Already active' : desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="targetWords" className="text-xs uppercase tracking-wide text-muted-foreground">
              Target words
            </Label>
            <Input
              id="targetWords"
              type="number"
              min={1}
              max={10_000_000}
              value={targetWords}
              onChange={(e) => setTargetWords(e.target.value)}
              className="mt-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate" className="text-xs uppercase tracking-wide text-muted-foreground">
                Start
              </Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startStr}
                onChange={(e) => handleStartChange(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs uppercase tracking-wide text-muted-foreground">
                End {type === 'TOTAL' && <span className="normal-case text-[10px]">(optional)</span>}
              </Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="mt-2"
                disabled={type !== 'TOTAL' && false}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-brand text-brand-ink hover:bg-brand-hover"
            >
              {pending ? 'Creating…' : 'Create goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
