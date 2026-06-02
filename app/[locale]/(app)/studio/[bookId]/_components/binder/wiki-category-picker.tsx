'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CATEGORY_TEMPLATES } from '@/lib/wiki/category-templates'
import type { WikiCategory } from '@/lib/wiki/category-templates'

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
        <div className="grid grid-cols-4 gap-3 mt-2">
          {CATEGORY_TEMPLATES.map(t => {
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
                className="group cursor-pointer flex flex-col items-start gap-2 p-3 text-left transition-[box-shadow,filter] hover:brightness-110 hover:[box-shadow:var(--sh-tile),0_0_0_1px_oklch(from_var(--brand)_l_c_h_/_0.45)]"
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                  style={{
                    color: `var(${t.accentColor})`,
                    background: `oklch(from var(${t.accentColor}) l c h / 0.12)`,
                  }}
                >
                  <Icon size={16} />
                </span>
                <div
                  className="font-comfortaa font-bold text-[13px] leading-tight"
                  style={{ color: 'var(--canvas-dark-ink-strong)' }}
                >
                  {t.label}
                </div>
                <div
                  className="text-[11px] leading-snug"
                  style={{ color: 'var(--canvas-dark-ink)' }}
                >
                  {t.blurb}
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
