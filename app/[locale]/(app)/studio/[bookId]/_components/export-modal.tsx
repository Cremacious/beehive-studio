'use client'

import { useState } from 'react'
import { FileText, BookOpen, Printer, X, Download } from 'lucide-react'
import { useBookEditor } from './book-editor-provider'

type Format = 'docx' | 'epub' | 'pdf'
type DocxStyle = 'manuscript' | 'basic'

type Props = {
  open: boolean
  onClose: () => void
}

async function downloadFile(url: string, fallbackFilename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? fallbackFilename

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

type FormatDef = {
  value: Format
  label: string
  meta: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  disabled?: boolean
}

const FORMATS: FormatDef[] = [
  { value: 'docx', label: 'DOCX',  meta: 'Word document · agent-ready', Icon: FileText },
  { value: 'epub', label: 'EPUB',  meta: 'For e-readers · self-publishing', Icon: BookOpen },
  { value: 'pdf',  label: 'PDF',   meta: 'Coming soon', Icon: Printer, disabled: true },
]

export function ExportModal({ open, onClose }: Props) {
  const { bookId, bookTitle, wordCount } = useBookEditor()
  const [format, setFormat] = useState<Format>('docx')
  const [docxStyle, setDocxStyle] = useState<DocxStyle>('manuscript')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleDownload() {
    setError(null)
    setLoading(true)
    try {
      if (format === 'docx') {
        await downloadFile(
          `/api/export/${bookId}/docx?style=${docxStyle}`,
          `manuscript.docx`,
        )
      } else if (format === 'epub') {
        await downloadFile(`/api/export/${bookId}/epub`, `book.epub`)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="w-[640px] max-w-[92vw] rounded-lg border border-border bg-popover shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[22px] pt-[18px] pb-[14px] gap-[18px]">
          <div>
            <h3
              id="export-title"
              className="text-foreground m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.005em',
              }}
            >
              Export {bookTitle}
            </h3>
            <p
              className="mt-0.5"
              style={{ fontSize: 11, color: 'var(--chrome-500)' }}
            >
              {wordCount.toLocaleString()} words
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close export"
            className="inline-flex items-center justify-center rounded-md transition-colors hover:bg-surface-elevated"
            style={{ width: 30, height: 30, color: 'var(--chrome-400)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-[22px] pb-[6px]">
          {/* Format picker */}
          <div
            className="font-mono uppercase mb-3"
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              color: 'var(--chrome-500)',
            }}
          >
            Format
          </div>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {FORMATS.map(f => {
              const isActive = format === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => { if (!f.disabled) setFormat(f.value) }}
                  disabled={f.disabled}
                  className="text-left rounded-md transition-colors relative"
                  style={{
                    padding: '14px 14px 12px',
                    border: `1px solid ${isActive ? 'oklch(0.85 0.18 90 / 0.5)' : 'var(--chrome-700)'}`,
                    background: isActive ? 'var(--brand-soft)' : 'var(--chrome-800)',
                    boxShadow: isActive ? '0 0 0 1px oklch(0.85 0.18 90 / 0.25)' : 'none',
                    cursor: f.disabled ? 'not-allowed' : 'pointer',
                    opacity: f.disabled ? 0.5 : 1,
                  }}
                >
                  <div
                    className="inline-flex items-center justify-center mb-2.5"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      background: isActive
                        ? 'linear-gradient(180deg, var(--paper-100), oklch(0.92 0.020 82))'
                        : 'linear-gradient(180deg, var(--chrome-900), var(--chrome-850))',
                      border: `1px solid ${isActive ? 'oklch(0.82 0.020 78)' : 'var(--chrome-700)'}`,
                      color: isActive ? 'var(--paper-ink-strong)' : 'var(--chrome-100)',
                    }}
                  >
                    <f.Icon size={20} />
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '-0.005em',
                      color: isActive ? 'var(--color-brand)' : 'var(--chrome-100)',
                      marginBottom: 2,
                    }}
                  >
                    {f.label}
                  </div>
                  <div
                    style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--chrome-400)' }}
                  >
                    {f.meta}
                  </div>
                </button>
              )
            })}
          </div>

          {/* DOCX style picker */}
          {format === 'docx' && (
            <>
              <div
                className="font-mono uppercase mb-3"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  color: 'var(--chrome-500)',
                }}
              >
                Style preset
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                {(['manuscript', 'basic'] as DocxStyle[]).map(s => {
                  const isActive = docxStyle === s
                  return (
                    <button
                      key={s}
                      onClick={() => setDocxStyle(s)}
                      className="text-left rounded-md transition-colors"
                      style={{
                        padding: '12px 14px',
                        border: `1px solid ${isActive ? 'oklch(0.85 0.18 90 / 0.5)' : 'var(--chrome-700)'}`,
                        background: isActive ? 'var(--brand-soft)' : 'var(--chrome-800)',
                        boxShadow: isActive ? '0 0 0 1px oklch(0.85 0.18 90 / 0.25)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 12.5,
                          fontWeight: 700,
                          letterSpacing: '-0.005em',
                          color: isActive ? 'var(--color-brand)' : 'var(--chrome-100)',
                          marginBottom: 2,
                        }}
                      >
                        {s === 'manuscript' ? 'Manuscript' : 'Basic'}
                      </div>
                      <div
                        style={{ fontSize: 10.5, lineHeight: 1.4, color: 'var(--chrome-500)' }}
                      >
                        {s === 'manuscript'
                          ? 'Double-spaced · Times New Roman · Agent-ready'
                          : 'Single-spaced · Calibri · Clean formatting'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* EPUB description */}
          {format === 'epub' && (
            <div
              className="mb-5 rounded-md px-4 py-3"
              style={{
                border: '1px solid var(--chrome-700)',
                background: 'var(--chrome-800)',
                fontSize: 12,
                color: 'var(--chrome-300)',
                lineHeight: 1.5,
              }}
            >
              For e-readers and self-publishing platforms. Includes a table of contents and chapter navigation.
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="mb-4 rounded-md px-3 py-2"
              style={{
                fontSize: 12,
                border: '1px solid oklch(0.55 0.180 25 / 0.4)',
                background: 'oklch(0.45 0.180 25 / 0.15)',
                color: 'oklch(0.78 0.140 25)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-[22px] py-[14px]"
          style={{ borderTop: '1px solid var(--chrome-800)' }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm transition-colors text-foreground/80 hover:text-foreground hover:bg-surface-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors bg-brand text-brand-ink hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {loading ? 'Preparing…' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
