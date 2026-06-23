'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, FileUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useBookEditor } from '../book-editor-provider'
import { useDocumentImport } from '@/components/import/use-document-import'
import { ImportDropzone } from '@/components/import/import-dropzone'
import { ChapterPreview } from '@/components/import/chapter-preview'
import { ImportUpsell } from '@/components/import/import-upsell'
import { commitImportAction } from '@/lib/import/import.actions'

type Props = {
  open: boolean
  onClose: () => void
}

// Append mode is docx + pdf only (epub is whole-book import via the wizard).
const APPEND_FORMATS = ['docx', 'pdf'] as const

export function ImportModal({ open, onClose }: Props) {
  const { bookId, bookTitle, locale, isPremium, addBinderItem, setActiveItemId } = useBookEditor()
  const imp = useDocumentImport({ allowedFormats: APPEND_FORMATS })
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  if (!open) return null

  function close() {
    if (committing) return
    imp.reset()
    setCommitError(null)
    onClose()
  }

  async function handleConfirm() {
    if (!imp.preview) return
    setCommitError(null)
    setCommitting(true)
    try {
      const chapters = imp.getChapters(bookTitle)
      const result = await commitImportAction({ bookId, chapters })
      if (!result.success) {
        setCommitError(
          result.error === 'PREMIUM_REQUIRED:import'
            ? 'Importing is a premium feature.'
            : result.error === 'FREE_LIMIT_REACHED'
              ? 'This book is read-only on the free plan.'
              : result.error,
        )
        return
      }
      for (const item of result.data.items) addBinderItem(item)
      if (result.data.items[0]) setActiveItemId(result.data.items[0].id)
      toast.success(
        `Imported ${result.data.count} ${result.data.count === 1 ? 'chapter' : 'chapters'}`,
      )
      imp.reset()
      onClose()
    } finally {
      setCommitting(false)
    }
  }

  const showConfirm = isPremium && imp.status === 'preview'

  if (typeof document === 'undefined') return null

  // Portal to <body> so the fixed overlay escapes the studio shell's
  // transformed/resizable ancestors (which would otherwise clip it inside the
  // binder column).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'oklch(0 0 0 / 0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="w-[560px] max-w-[92vw]"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-[18px] px-[22px] pt-[18px] pb-[14px]">
          <div>
            <h3
              id="import-title"
              className="m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.005em',
                color: 'var(--brand)',
              }}
            >
              Import chapters
            </h3>
            <p className="mt-[3px]" style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>
              Add chapters to {bookTitle} from a file
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Close import"
            className="inline-flex flex-none items-center justify-center rounded-md transition-colors"
            style={{ width: 30, height: 30, color: 'var(--canvas-dark-ink-muted)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] pb-[2px]">
          {!isPremium ? (
            <ImportUpsell locale={locale} isAuthed />
          ) : imp.status === 'parsing' ? (
            <div className="flex items-center justify-center gap-3 py-10" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: 13 }}>Reading your file…</span>
            </div>
          ) : imp.status === 'preview' && imp.preview ? (
            <ChapterPreview
              preview={imp.preview}
              splitMode={imp.splitMode}
              onSplitModeChange={imp.setSplitMode}
            />
          ) : (
            <ImportDropzone
              accept=".docx,.pdf"
              acceptLabel="DOCX or PDF"
              onPick={(file) => imp.parse(file)}
            />
          )}

          {/* Error */}
          {(imp.error || commitError) && isPremium && (
            <div
              className="mt-4 mb-1 rounded-md px-3 py-2"
              style={{
                fontSize: 12,
                border: '1px solid oklch(0.55 0.180 25 / 0.4)',
                background: 'oklch(0.45 0.180 25 / 0.15)',
                color: 'oklch(0.82 0.140 25)',
              }}
            >
              {commitError ?? imp.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-[22px] py-[14px] mt-2"
          style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)' }}
        >
          <button
            onClick={close}
            disabled={committing}
            className="rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-50"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {showConfirm ? 'Cancel' : 'Close'}
          </button>
          {showConfirm && (
            <button
              onClick={handleConfirm}
              disabled={committing}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              <FileUp size={14} />
              {committing ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
