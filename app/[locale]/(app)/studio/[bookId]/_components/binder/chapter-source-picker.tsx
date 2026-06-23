'use client'

import { FileText, FileUp, Sparkles } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

type Card = {
  source: 'blank' | 'import'
  label: string
  blurb: string
  icon: typeof FileText
  accent: string
}

const CARDS: Card[] = [
  {
    source: 'blank',
    label: 'Blank chapter',
    blurb: 'Start with an empty page and write from scratch.',
    icon: FileText,
    accent: '--type-chapter',
  },
  {
    source: 'import',
    label: 'Import from a file',
    blurb: 'Pull chapters in from a DOCX or PDF.',
    icon: FileUp,
    accent: '--type-chapter',
  },
]

export function ChapterSourcePicker({
  open,
  onOpenChange,
  onPick,
  isPremium,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPick: (source: 'blank' | 'import') => void
  isPremium: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] p-7 gap-6 dialog-ios"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
      >
        <div className="flex flex-col gap-2">
          <h2
            className="font-bold text-[18px] leading-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--brand)', margin: 0 }}
          >
            New chapter
          </h2>
          <p
            className="text-[13px] leading-snug"
            style={{ color: 'var(--canvas-dark-ink-muted)', margin: 0 }}
          >
            Start fresh or bring an existing chapter in from a file.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CARDS.map((card) => {
            const Icon = card.icon
            const showPremium = card.source === 'import' && !isPremium
            return (
              <button
                key={card.source}
                type="button"
                onClick={() => onPick(card.source)}
                className="group cursor-pointer flex flex-col items-start gap-2.5 p-4 text-left transition-[filter,box-shadow] hover:brightness-110 min-w-0"
                style={{
                  borderRadius: 'var(--r-row)',
                  boxShadow: 'var(--sh-tile)',
                  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  border: 'var(--br-card)',
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
                <span className="flex items-center gap-2 self-stretch justify-between">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-btn)] flex-shrink-0"
                    style={{
                      color: `var(${card.accent})`,
                      background: `oklch(from var(${card.accent}) l c h / 0.14)`,
                    }}
                  >
                    <Icon size={18} />
                  </span>
                  {showPremium && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm uppercase"
                      style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        background: 'var(--brand)',
                        color: 'var(--brand-ink)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <Sparkles size={8} /> Premium
                    </span>
                  )}
                </span>
                <div
                  className="font-bold text-[14px] leading-tight"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--canvas-dark-ink-strong)' }}
                >
                  {card.label}
                </div>
                <div className="text-[12.5px] leading-snug" style={{ color: 'var(--canvas-dark-ink)', fontWeight: 400 }}>
                  {card.blurb}
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
