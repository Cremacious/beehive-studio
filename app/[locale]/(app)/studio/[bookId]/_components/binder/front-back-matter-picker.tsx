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
        className="sm:max-w-[560px] p-7 gap-6 dialog-ios"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
      >
        <div className="flex flex-col gap-2">
          <h2
            className="font-bold text-[18px] leading-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--brand)',
              margin: 0,
            }}
          >
            Front or back matter?
          </h2>
          <p
            className="text-[13px] leading-snug"
            style={{ color: 'var(--canvas-dark-ink-muted)', margin: 0 }}
          >
            Pick which one to add. You can choose the specific page (title
            page, dedication, acknowledgments) right after.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CARDS.map((card) => {
            const Icon = card.icon
            return (
              <button
                key={card.kind}
                type="button"
                onClick={() => onPick(card.kind)}
                className="group cursor-pointer flex flex-col items-start gap-2.5 p-4 text-left transition-[filter,box-shadow] hover:brightness-110 min-w-0"
                style={{
                  borderRadius: 'var(--r-row)',
                  boxShadow: 'var(--sh-tile)',
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  border: 'var(--br-card)',
                  // Defeat global button rules that fight this card layout:
                  whiteSpace: 'normal',
                  textTransform: 'none',
                  wordBreak: 'normal',
                  overflowWrap: 'anywhere',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    'var(--sh-tile), 0 0 0 1px oklch(from var(--brand) l c h / 0.45)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--sh-tile)'
                }}
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-btn)] flex-shrink-0"
                  style={{
                    color: `var(${card.accent})`,
                    background: `oklch(from var(${card.accent}) l c h / 0.14)`,
                  }}
                >
                  <Icon size={18} />
                </span>
                <div
                  className="font-bold text-[14px] leading-tight"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--canvas-dark-ink-strong)',
                  }}
                >
                  {card.label}
                </div>
                <div
                  className="text-[12.5px] leading-snug"
                  style={{
                    color: 'var(--canvas-dark-ink)',
                    fontWeight: 400,
                  }}
                >
                  {card.blurb}
                </div>
                <div
                  className="text-[10px] font-mono mt-1 self-stretch"
                  style={{
                    color: 'var(--canvas-dark-ink-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    paddingTop: '8px',
                    borderTop: '1px solid oklch(1 0 0 / 0.04)',
                  }}
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
