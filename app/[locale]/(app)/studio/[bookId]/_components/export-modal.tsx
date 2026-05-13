'use client'

import { useState } from 'react'
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
      <div className="w-[420px] rounded-lg border border-[#2a2a2a] bg-[#161616] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">{bookTitle}</h2>
            <p className="text-[10px] text-[#555] mt-0.5">{wordCount.toLocaleString()} words</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#888] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {/* Format tabs */}
          <div className="mb-5">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-[#555]">Format</div>
            <div className="flex gap-2">
              {(['docx', 'epub', 'pdf'] as Format[]).map(f => (
                <button
                  key={f}
                  onClick={() => { if (f !== 'pdf') setFormat(f) }}
                  disabled={f === 'pdf'}
                  className={[
                    'flex-1 rounded-md border px-3 py-3 text-center text-sm font-medium transition-colors',
                    format === f
                      ? 'border-[#FFC300] bg-[#1f1a00] text-[#FFC300]'
                      : f === 'pdf'
                        ? 'border-[#2a2a2a] bg-[#111] text-[#444] cursor-not-allowed opacity-50'
                        : 'border-[#2a2a2a] bg-[#111] text-[#888] hover:border-[#3a3a3a] hover:text-[#aaa]',
                  ].join(' ')}
                >
                  <div className="text-base mb-1">
                    {f === 'docx' ? '📄' : f === 'epub' ? '📖' : '🖨'}
                  </div>
                  <div>{f.toUpperCase()}</div>
                  {f === 'pdf' && (
                    <div className="text-[9px] text-[#444] mt-0.5">Soon</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* DOCX style selector */}
          {format === 'docx' && (
            <div className="mb-5">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-[#555]">Style</div>
              <div className="flex gap-2">
                {(['manuscript', 'basic'] as DocxStyle[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setDocxStyle(s)}
                    className={[
                      'flex-1 rounded-md border px-3 py-2.5 text-left transition-colors',
                      docxStyle === s
                        ? 'border-[#FFC300] bg-[#1f1a00]'
                        : 'border-[#2a2a2a] bg-[#111] hover:border-[#3a3a3a]',
                    ].join(' ')}
                  >
                    <div className={`text-xs font-semibold ${docxStyle === s ? 'text-[#FFC300]' : 'text-[#aaa]'}`}>
                      {s === 'manuscript' ? 'Manuscript' : 'Basic'}
                    </div>
                    <div className="text-[10px] text-[#555] mt-0.5">
                      {s === 'manuscript'
                        ? 'Double-spaced · Times New Roman · Agent-ready'
                        : 'Single-spaced · Calibri · Clean formatting'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* EPUB description */}
          {format === 'epub' && (
            <div className="mb-5 rounded-md border border-[#2a2a2a] bg-[#111] px-4 py-3">
              <div className="text-xs text-[#888]">
                For e-readers and self-publishing platforms. Includes a table of contents and chapter navigation.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={loading}
            className="w-full rounded-md bg-[#FFC300] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Preparing download…' : `↓ Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
