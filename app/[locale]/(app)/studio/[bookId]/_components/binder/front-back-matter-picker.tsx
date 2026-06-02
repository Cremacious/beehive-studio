'use client'

import { ScrollText, BookMarked } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

type Kind = 'front_matter' | 'back_matter'

type Card = {
  kind: Kind
  label: string
  blurb: string
  examples: string
  icon: typeof ScrollText
  accent: string
}

const CARDS: Card[] = [
  {
    kind: 'front_matter',
    label: 'Front matter',
    blurb: 'Everything that appears before your story begins.',
    examples: 'Title page · Copyright · Dedication',
    icon: ScrollText,
    accent: '--type-front-matter',
  },
  {
    kind: 'back_matter',
    label: 'Back matter',
    blurb: 'Everything that appears after your story ends.',
    examples: 'Acknowledgments · About the author',
    icon: BookMarked,
    accent: '--type-back-matter',
  },
]

export function FrontBackMatterPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPick: (kind: Kind) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="sm:max-w-xl"
      >
        <div className="flex flex-col gap-1 text-center pt-1">
          <h3
            className="text-xl font-bold"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--canvas-dark-ink-strong)',
            }}
          >
            Front or Back Matter?
          </h3>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--canvas-dark-ink)' }}
          >
            Pick which one to add. You can pick the specific page (title page,
            dedication, acknowledgments…) right after.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          {CARDS.map(card => {
            const Icon = card.icon
            return (
              <button
                key={card.kind}
                type="button"
                onClick={() => onPick(card.kind)}
                style={{
                  borderRadius: 'var(--r-row)',
                  boxShadow: 'var(--sh-tile)',
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-250))',
                  border: 'var(--br-card)',
                }}
                className="group cursor-pointer flex flex-col items-start gap-2.5 p-4 text-left transition-[box-shadow,filter] hover:brightness-110 hover:[box-shadow:var(--sh-tile),0_0_0_1px_oklch(from_var(--brand)_l_c_h_/_0.45)]"
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                  style={{
                    color: `var(${card.accent})`,
                    background: `oklch(from var(${card.accent}) l c h / 0.12)`,
                  }}
                >
                  <Icon size={18} />
                </span>
                <div
                  className="font-comfortaa font-bold text-[14px] leading-tight"
                  style={{ color: 'var(--canvas-dark-ink-strong)' }}
                >
                  {card.label}
                </div>
                <div
                  className="text-[12px] leading-snug"
                  style={{ color: 'var(--canvas-dark-ink)' }}
                >
                  {card.blurb}
                </div>
                <div
                  className="text-[10px] font-mono uppercase tracking-[0.08em] mt-auto"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {card.examples}
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
