'use client'

import { useState } from 'react'
import { FileText, BookOpen, Printer, X, Download, Check } from 'lucide-react'
import { useBookEditor } from './book-editor-provider'

type Format = 'docx' | 'epub' | 'pdf'
type StylePreset = 'manuscript' | 'basic'

// DOCX and PDF share the manuscript/basic preset picker.
const PRESET_FORMATS: Format[] = ['docx', 'pdf']

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
  desc: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
}

const FORMATS: FormatDef[] = [
  { value: 'docx', label: 'DOCX', desc: 'Word document, agent-ready', Icon: FileText },
  { value: 'epub', label: 'EPUB', desc: 'For e-readers and self-publishing', Icon: BookOpen },
  { value: 'pdf', label: 'PDF', desc: 'Print-ready, with front and back matter', Icon: Printer },
]

const PRESET_DESC: Record<StylePreset, (f: Format) => string> = {
  manuscript: () => 'Double-spaced, Times New Roman, running header and page numbers',
  basic: (f) =>
    f === 'pdf'
      ? 'Single-spaced, Helvetica, clean formatting'
      : 'Single-spaced, Calibri, clean formatting',
}

// Shared token-driven surfaces (canonical --canvas-dark-* / --brand system).
const TILE_BG = 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
const BRAND_BORDER = 'oklch(0.85 0.18 90 / 0.5)'
const CREAM_CHIP = 'linear-gradient(180deg, #fdf6e3, #f3e7c4)'

export function ExportModal({ open, onClose }: Props) {
  const { bookId, bookTitle, wordCount } = useBookEditor()
  const [format, setFormat] = useState<Format>('docx')
  const [stylePreset, setStylePreset] = useState<StylePreset>('manuscript')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const showPreset = PRESET_FORMATS.includes(format)

  async function handleDownload() {
    setError(null)
    setLoading(true)
    try {
      if (format === 'docx') {
        await downloadFile(`/api/export/${bookId}/docx?style=${stylePreset}`, 'manuscript.docx')
      } else if (format === 'pdf') {
        await downloadFile(`/api/export/${bookId}/pdf?style=${stylePreset}`, 'book.pdf')
      } else if (format === 'epub') {
        await downloadFile(`/api/export/${bookId}/epub`, 'book.epub')
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
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'oklch(0 0 0 / 0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
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
              id="export-title"
              className="m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.005em',
                color: 'var(--brand)',
              }}
            >
              Export {bookTitle}
            </h3>
            <p className="mt-[3px]" style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>
              {wordCount.toLocaleString()} words
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close export"
            className="inline-flex flex-none items-center justify-center rounded-md transition-colors"
            style={{ width: 30, height: 30, color: 'var(--canvas-dark-ink-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(1 0 0 / 0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-[22px] pb-[2px]">
          {/* Format label */}
          <div
            className="font-mono uppercase mb-3"
            style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--canvas-dark-ink-muted)' }}
          >
            Format
          </div>

          {/* Format rows */}
          <div role="radiogroup" aria-label="Export format" className="flex flex-col gap-2 mb-1">
            {FORMATS.map(f => {
              const isActive = format === f.value
              return (
                <button
                  key={f.value}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setFormat(f.value)}
                  className="flex items-center gap-[14px] text-left transition-colors"
                  style={{
                    padding: '13px 14px',
                    borderRadius: 'var(--r-row)',
                    border: `1px solid ${isActive ? BRAND_BORDER : 'transparent'}`,
                    background: isActive ? 'var(--brand-soft)' : TILE_BG,
                    boxShadow: isActive ? '0 0 0 1px oklch(0.85 0.18 90 / 0.25)' : 'var(--sh-tile)',
                  }}
                >
                  <span
                    className="inline-flex flex-none items-center justify-center"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 9,
                      background: isActive ? CREAM_CHIP : 'var(--canvas-dark-100)',
                      border: `1px solid ${isActive ? '#d8c48a' : 'oklch(1 0 0 / 0.06)'}`,
                      color: isActive ? 'var(--brand-ink)' : 'var(--canvas-dark-ink)',
                    }}
                  >
                    <f.Icon size={19} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className="block"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: '-0.005em',
                        color: isActive ? 'var(--brand)' : 'var(--canvas-dark-ink)',
                      }}
                    >
                      {f.label}
                    </span>
                    <span
                      className="block"
                      style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--canvas-dark-ink-muted)', marginTop: 1 }}
                    >
                      {f.desc}
                    </span>
                  </span>
                  <span
                    className="inline-flex flex-none items-center justify-center"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: isActive ? 'none' : '2px solid oklch(1 0 0 / 0.18)',
                      background: isActive ? 'var(--brand)' : 'transparent',
                      color: 'var(--brand-ink)',
                    }}
                  >
                    {isActive && <Check size={13} strokeWidth={3} />}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Style preset — DOCX + PDF only */}
          {showPreset && (
            <>
              <div
                className="font-mono uppercase mb-3 mt-5"
                style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--canvas-dark-ink-muted)' }}
              >
                Style preset
              </div>
              <div
                role="radiogroup"
                aria-label="Style preset"
                className="flex gap-1 p-1 mb-2"
                style={{
                  background: 'var(--canvas-dark-100)',
                  borderRadius: 'var(--r-btn)',
                  boxShadow: 'var(--sh-tile)',
                }}
              >
                {(['manuscript', 'basic'] as StylePreset[]).map(s => {
                  const isActive = stylePreset === s
                  return (
                    <button
                      key={s}
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setStylePreset(s)}
                      className="flex-1 transition-colors"
                      style={{
                        padding: '9px 0',
                        borderRadius: 9,
                        fontFamily: 'var(--font-display)',
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '-0.005em',
                        background: isActive ? 'var(--brand-soft)' : 'transparent',
                        boxShadow: isActive ? '0 0 0 1px oklch(0.85 0.18 90 / 0.3)' : 'none',
                        color: isActive ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                      }}
                    >
                      {s === 'manuscript' ? 'Manuscript' : 'Basic'}
                    </button>
                  )
                })}
              </div>
              <p
                className="mb-1"
                style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--canvas-dark-ink-muted)' }}
              >
                {PRESET_DESC[stylePreset](format)}
              </p>
            </>
          )}

          {/* EPUB description */}
          {format === 'epub' && (
            <p
              className="mt-4 mb-1"
              style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--canvas-dark-ink-muted)' }}
            >
              For e-readers and self-publishing platforms. Includes a table of contents and chapter navigation.
            </p>
          )}

          {/* Error */}
          {error && (
            <div
              className="mt-4 mb-1 rounded-md px-3 py-2"
              style={{
                fontSize: 12,
                border: '1px solid oklch(0.55 0.180 25 / 0.4)',
                background: 'oklch(0.45 0.180 25 / 0.15)',
                color: 'oklch(0.82 0.140 25)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-[22px] py-[14px] mt-2"
          style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)' }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-50"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'oklch(1 0 0 / 0.06)'; e.currentTarget.style.color = 'var(--canvas-dark-ink)' } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--canvas-dark-ink-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--brand-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand)' }}
          >
            <Download size={14} />
            {loading ? 'Preparing…' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
