'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CATEGORY_TEMPLATES } from '@/lib/wiki/category-templates'
import type { WikiCategory } from '@/lib/wiki/category-templates'

// Wiki category picker. Redesigned (issue #50) around a row layout so it works
// identically on desktop and mobile: each category is a horizontal tile (icon
// chip + a min-w-0 text column that wraps), laid out one-per-row on phones and
// two-per-row from `sm` up. The shared Dialog chrome turns it into a centered
// card on desktop and a bottom-sheet on phones, so nothing is ever clipped.
export function WikiCategoryPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPick: (category: WikiCategory) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>New wiki entry</DialogTitle>
          <DialogDescription>Pick a category to start from.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:max-h-[58vh] sm:overflow-y-auto -mx-1 px-1">
          {CATEGORY_TEMPLATES.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.category}
                type="button"
                onClick={() => onPick(t.category)}
                style={{
                  borderRadius: 'var(--r-row)',
                  boxShadow: 'var(--sh-tile)',
                  background: 'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-250))',
                  border: 'var(--br-card)',
                }}
                className="group flex w-full items-start gap-3 p-3 text-left cursor-pointer transition-[box-shadow,filter] hover:brightness-110 hover:[box-shadow:var(--sh-tile),0_0_0_1px_oklch(from_var(--brand)_l_c_h_/_0.45)]"
              >
                <span
                  className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-md"
                  style={{
                    color: `var(${t.accentColor})`,
                    background: `oklch(from var(${t.accentColor}) l c h / 0.12)`,
                  }}
                >
                  <Icon size={17} />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className="block font-comfortaa font-bold text-[13px] leading-tight"
                    style={{ color: 'var(--canvas-dark-ink-strong)' }}
                  >
                    {t.label}
                  </span>
                  <span
                    className="mt-0.5 block text-[11px] leading-snug break-words"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  >
                    {t.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
