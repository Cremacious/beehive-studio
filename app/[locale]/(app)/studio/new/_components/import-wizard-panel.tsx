'use client'

import { ArrowLeft, FileUp, Loader2 } from 'lucide-react'
import { useDocumentImport } from '@/components/import/use-document-import'
import { ImportDropzone } from '@/components/import/import-dropzone'
import { ChapterPreview } from '@/components/import/chapter-preview'
import { ImportUpsell } from '@/components/import/import-upsell'
import type { ImportedChapter } from '@/lib/import/types'

type Props = {
  locale: string
  isPremium: boolean
  onBack: () => void
  /** Called when the user confirms. Hands back chapters + the detected title. */
  onConfirm: (chapters: ImportedChapter[], detectedTitle: string | null) => void
}

const PANEL = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  border: 'var(--br-card)',
} as const

const PDF_NOTE = 'PDF import is text-only. Formatting may need cleanup after import.'

export function ImportWizardPanel({ locale, isPremium, onBack, onConfirm }: Props) {
  const imp = useDocumentImport()

  function confirm() {
    if (!imp.preview) return
    const title = imp.preview.detectedTitle ?? 'Imported book'
    onConfirm(imp.getChapters(title), imp.preview.detectedTitle)
  }

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ padding: '28px' }}>
      <div className="mx-auto w-full flex flex-col" style={{ maxWidth: '720px', ...PANEL }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-[18px]" style={{ borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="inline-flex items-center justify-center shrink-0"
            style={{
              width: 32, height: 32, borderRadius: 'var(--r-pill)',
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              color: 'var(--canvas-dark-ink-muted)', boxShadow: 'var(--sh-tile)',
            }}
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <h2
              className="m-0"
              style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--brand)' }}
            >
              Import a manuscript
            </h2>
            <p className="m-0" style={{ fontSize: 12.5, color: 'var(--canvas-dark-ink-muted)' }}>
              Upload a DOCX, PDF, or EPUB and we&apos;ll detect the chapters.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {!isPremium ? (
            <ImportUpsell locale={locale} isAuthed />
          ) : imp.status === 'parsing' ? (
            <div className="flex items-center justify-center gap-3 py-12" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: 13 }}>Reading your file…</span>
            </div>
          ) : imp.status === 'preview' && imp.preview ? (
            <ChapterPreview preview={imp.preview} splitMode={imp.splitMode} onSplitModeChange={imp.setSplitMode} />
          ) : (
            <ImportDropzone
              accept=".docx,.pdf,.epub"
              acceptLabel="DOCX, PDF, or EPUB"
              note={PDF_NOTE}
              onPick={(file) => imp.parse(file)}
            />
          )}

          {imp.error && isPremium && (
            <div
              className="mt-4 rounded-md px-3 py-2"
              style={{
                fontSize: 12,
                border: '1px solid oklch(0.55 0.180 25 / 0.4)',
                background: 'oklch(0.45 0.180 25 / 0.15)',
                color: 'oklch(0.82 0.140 25)',
              }}
            >
              {imp.error}
            </div>
          )}
        </div>

        {/* Footer */}
        {isPremium && imp.status === 'preview' && (
          <div
            className="flex items-center justify-end gap-2 px-6 py-[14px]"
            style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)' }}
          >
            <button
              type="button"
              onClick={() => imp.reset()}
              className="rounded-md px-4 py-2 text-sm"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Choose a different file
            </button>
            <button
              type="button"
              onClick={confirm}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              <FileUp size={14} />
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
