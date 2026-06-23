'use client'

import Link from 'next/link'
import { PenLine, FileUp, Sparkles, X } from 'lucide-react'

type Props = {
  locale: string
  isPremium: boolean
  onPickScratch: () => void
  onPickImport: () => void
}

const PANEL = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  border: 'var(--br-card)',
} as const

const CARD = {
  borderRadius: 'var(--r-row)',
  boxShadow: 'var(--sh-tile)',
  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  border: 'var(--br-card)',
} as const

export function CreationPathLanding({ locale, isPremium, onPickScratch, onPickImport }: Props) {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ padding: '28px' }}>
      <div className="mx-auto w-full flex flex-col" style={{ maxWidth: '720px', ...PANEL }}>
        <div className="flex items-start justify-between px-7 pt-7 pb-2">
          <div>
            <h1
              className="m-0"
              style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--canvas-dark-ink-strong)' }}
            >
              How do you want to start?
            </h1>
            <p className="m-0 mt-1.5" style={{ fontSize: 14, color: 'var(--canvas-dark-ink-muted)' }}>
              Begin a fresh manuscript, or bring one you already have.
            </p>
          </div>
          <Link
            href={`/${locale}/studio`}
            aria-label="Cancel and return to studio"
            className="inline-flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: 'var(--r-pill)',
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              color: 'var(--canvas-dark-ink-muted)', boxShadow: 'var(--sh-tile)',
            }}
          >
            <X size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-7">
          <button
            type="button"
            onClick={onPickScratch}
            className="flex flex-col items-start gap-3 p-5 text-left transition-[filter] hover:brightness-110"
            style={CARD}
          >
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-btn)]"
              style={{ color: 'var(--type-chapter)', background: 'oklch(from var(--type-chapter) l c h / 0.14)' }}
            >
              <PenLine size={20} />
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--canvas-dark-ink-strong)' }}>
              Start from scratch
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--canvas-dark-ink)' }}>
              Set up your book details and start writing with an empty binder.
            </span>
          </button>

          <button
            type="button"
            onClick={onPickImport}
            className="flex flex-col items-start gap-3 p-5 text-left transition-[filter] hover:brightness-110"
            style={CARD}
          >
            <span className="flex items-center gap-2 self-stretch justify-between">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-btn)]"
                style={{ color: 'var(--brand)', background: 'oklch(from var(--brand) l c h / 0.14)' }}
              >
                <FileUp size={20} />
              </span>
              {!isPremium && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm uppercase"
                  style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em',
                    background: 'var(--brand)', color: 'var(--brand-ink)', fontFamily: 'var(--font-mono)',
                  }}
                >
                  <Sparkles size={8} /> Premium
                </span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--canvas-dark-ink-strong)' }}>
              Import a manuscript
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--canvas-dark-ink)' }}>
              Upload a DOCX, PDF, or EPUB and we&apos;ll turn it into editable chapters.
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
