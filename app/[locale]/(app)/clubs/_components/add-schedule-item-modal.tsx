'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  addScheduleItemAction,
  updateScheduleItemAction,
} from '@/lib/actions/book-clubs.actions'

type InitialItem = {
  id: string
  bookId: string
  chapterStart: number
  chapterEnd: number
  targetDate: Date
  label: string | null
}

type Props = {
  clubId: string
  currentBookId: string
  currentBookTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialItem?: InitialItem | null
}

const toDateInputValue = (d: Date): string => {
  const iso = new Date(d).toISOString()
  return iso.slice(0, 10)
}

export function AddScheduleItemModal({
  clubId,
  currentBookId,
  currentBookTitle,
  open,
  onOpenChange,
  initialItem,
}: Props) {
  const isEdit = Boolean(initialItem)
  const [chapterStart, setChapterStart] = useState<string>('1')
  const [chapterEnd, setChapterEnd] = useState<string>('1')
  const [targetDate, setTargetDate] = useState<string>('')
  const [label, setLabel] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (open) {
      if (initialItem) {
        setChapterStart(String(initialItem.chapterStart))
        setChapterEnd(String(initialItem.chapterEnd))
        setTargetDate(toDateInputValue(initialItem.targetDate))
        setLabel(initialItem.label ?? '')
      } else {
        setChapterStart('1')
        setChapterEnd('1')
        setTargetDate(toDateInputValue(new Date()))
        setLabel('')
      }
    }
  }, [open, initialItem])

  const submit = () => {
    const startNum = parseInt(chapterStart, 10)
    const endNum = parseInt(chapterEnd, 10)
    if (!Number.isFinite(startNum) || startNum < 1) {
      toast.error('Chapter start must be at least 1')
      return
    }
    if (!Number.isFinite(endNum) || endNum < startNum) {
      toast.error('Chapter end must be ≥ chapter start')
      return
    }
    if (!targetDate) {
      toast.error('Pick a target date')
      return
    }
    const trimmedLabel = label.trim()

    startTransition(async () => {
      const result = isEdit
        ? await updateScheduleItemAction({
            itemId: initialItem!.id,
            chapterStart: startNum,
            chapterEnd: endNum,
            targetDate: new Date(targetDate),
            label: trimmedLabel ? trimmedLabel : null,
          })
        : await addScheduleItemAction({
            clubId,
            bookId: currentBookId,
            chapterStart: startNum,
            chapterEnd: endNum,
            targetDate: new Date(targetDate),
            label: trimmedLabel || undefined,
          })

      if (result.success) {
        toast.success(isEdit ? 'Milestone updated' : 'Milestone added')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(
          isEdit
            ? `Could not update milestone (${result.error})`
            : `Could not add milestone (${result.error})`,
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit milestone' : 'Add milestone'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
              Book
            </label>
            <div
              className="w-full px-3 py-2 rounded-[var(--r-row)] border text-sm text-[var(--canvas-dark-ink-muted)]"
              style={{
                background: 'var(--canvas-dark-100)',
                borderColor: 'var(--br-card)',
              }}
            >
              {currentBookTitle}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
                Chapter start *
              </label>
              <input
                type="number"
                min={1}
                value={chapterStart}
                onChange={(e) => setChapterStart(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--r-row)] border text-sm text-[var(--canvas-dark-ink)] outline-none focus:border-[var(--canvas-dark-ink-muted)]"
                style={{
                  background: 'var(--canvas-dark-100)',
                  borderColor: 'var(--br-card)',
                }}
              />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
                Chapter end *
              </label>
              <input
                type="number"
                min={1}
                value={chapterEnd}
                onChange={(e) => setChapterEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--r-row)] border text-sm text-[var(--canvas-dark-ink)] outline-none focus:border-[var(--canvas-dark-ink-muted)]"
                style={{
                  background: 'var(--canvas-dark-100)',
                  borderColor: 'var(--br-card)',
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
              Target date *
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--r-row)] border text-sm text-[var(--canvas-dark-ink)] outline-none focus:border-[var(--canvas-dark-ink-muted)]"
              style={{
                background: 'var(--canvas-dark-100)',
                borderColor: 'var(--br-card)',
              }}
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 80))}
              maxLength={80}
              placeholder='e.g. "Week 1 — Act One"'
              className="w-full px-3 py-2 rounded-[var(--r-row)] border text-sm text-[var(--canvas-dark-ink)] outline-none focus:border-[var(--canvas-dark-ink-muted)]"
              style={{
                background: 'var(--canvas-dark-100)',
                borderColor: 'var(--br-card)',
              }}
            />
            <p className="mt-1 text-xs text-[var(--canvas-dark-ink-muted)]">
              Optional — up to 80 characters.
            </p>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="px-5 py-2 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {isPending
              ? isEdit
                ? 'Saving…'
                : 'Adding…'
              : isEdit
                ? 'Save changes'
                : 'Add milestone'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
