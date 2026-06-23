'use client'

import { useCallback, useState } from 'react'
import {
  validateDocumentFile,
  type ImportFormat,
} from '@/lib/upload/validate-document'
import { mergeToSingleChapter } from '@/lib/import/split-chapters'
import { parseImportAction } from '@/lib/import/import.actions'
import type { ImportedChapter, ImportPreview } from '@/lib/import/types'

export type ImportStatus = 'idle' | 'parsing' | 'preview' | 'error'
export type SplitMode = 'split' | 'single'

type Options = {
  /** Restrict accepted formats (append mode passes ['docx', 'pdf']). */
  allowedFormats?: readonly ImportFormat[]
}

export type DocumentImport = {
  status: ImportStatus
  error: string | null
  /** True when the failure is specifically the premium gate. */
  premiumBlocked: boolean
  preview: ImportPreview | null
  splitMode: SplitMode
  setSplitMode: (m: SplitMode) => void
  /** Validate (client) then parse (server). Updates status/preview/error. */
  parse: (file: File) => Promise<void>
  /**
   * The chapters to persist given the current split choice. `singleTitle` is
   * used as the merged chapter's title when splitMode === 'single'.
   */
  getChapters: (singleTitle: string) => ImportedChapter[]
  reset: () => void
}

export function useDocumentImport(opts: Options = {}): DocumentImport {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [premiumBlocked, setPremiumBlocked] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [splitMode, setSplitMode] = useState<SplitMode>('split')

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setPremiumBlocked(false)
    setPreview(null)
    setSplitMode('split')
  }, [])

  const parse = useCallback(
    async (file: File) => {
      setError(null)
      setPremiumBlocked(false)

      const clientError = validateDocumentFile(
        { name: file.name, type: file.type, size: file.size },
        { allowedFormats: opts.allowedFormats },
      )
      if (clientError) {
        setStatus('error')
        setError(clientError)
        return
      }

      setStatus('parsing')
      const fd = new FormData()
      fd.append('file', file)
      if (opts.allowedFormats) fd.append('allowedFormats', opts.allowedFormats.join(','))

      const result = await parseImportAction(fd)
      if (!result.success) {
        if (result.error === 'PREMIUM_REQUIRED:import') {
          setPremiumBlocked(true)
          setStatus('error')
          setError(null)
          return
        }
        setStatus('error')
        setError(result.error)
        return
      }
      setPreview(result.data)
      setSplitMode('split')
      setStatus('preview')
    },
    [opts.allowedFormats],
  )

  const getChapters = useCallback(
    (singleTitle: string): ImportedChapter[] => {
      if (!preview) return []
      if (splitMode === 'single') {
        return [mergeToSingleChapter(preview.chapters, singleTitle)]
      }
      return preview.chapters
    },
    [preview, splitMode],
  )

  return {
    status,
    error,
    premiumBlocked,
    preview,
    splitMode,
    setSplitMode,
    parse,
    getChapters,
    reset,
  }
}
