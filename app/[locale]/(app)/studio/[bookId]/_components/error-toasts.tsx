'use client'

import { useBookEditor } from './book-editor-provider'

export function ErrorToasts() {
  const { errors, dismissError, flashes } = useBookEditor()

  if (errors.length === 0 && flashes.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm">
      {flashes.map((msg, i) => (
        <div
          key={`flash-${i}`}
          className="flex items-center gap-2 bg-brand/10 border border-brand/30 text-brand rounded-lg px-4 py-2 text-sm shadow-lg"
        >
          <span>● {msg}</span>
        </div>
      ))}
      {errors.map((error, i) => (
        <div
          key={`err-${i}`}
          className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm shadow-lg"
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={() => dismissError(i)}
            className="text-destructive/60 hover:text-destructive transition-colors mt-0.5 leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
