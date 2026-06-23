'use client'

import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'

type Props = {
  /** Accept attribute for the file input, e.g. ".docx,.pdf,.epub". */
  accept: string
  /** Human label of accepted types, e.g. "DOCX, PDF, or EPUB". */
  acceptLabel: string
  /** Shown as a muted note (e.g. the PDF text-only caveat). */
  note?: string
  onPick: (file: File) => void
}

const TILE_BG = 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
const BRAND_BORDER = 'oklch(0.85 0.18 90 / 0.5)'

export function ImportDropzone({ accept, acceptLabel, note, onPick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) onPick(file)
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className="flex w-full flex-col items-center justify-center gap-2 text-center transition-colors"
        style={{
          padding: '32px 20px',
          borderRadius: 'var(--r-row)',
          border: `1.5px dashed ${dragging ? BRAND_BORDER : 'oklch(1 0 0 / 0.14)'}`,
          background: dragging ? 'var(--brand-soft)' : TILE_BG,
          boxShadow: 'var(--sh-tile)',
        }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: 'var(--canvas-dark-100)',
            border: '1px solid oklch(1 0 0 / 0.06)',
            color: 'var(--brand)',
          }}
        >
          <UploadCloud size={22} />
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--canvas-dark-ink)',
          }}
        >
          Drop a file or click to browse
        </span>
        <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>
          {acceptLabel}. Up to 25 MB.
        </span>
      </button>

      {note && (
        <p className="mt-3" style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--canvas-dark-ink-muted)' }}>
          {note}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
