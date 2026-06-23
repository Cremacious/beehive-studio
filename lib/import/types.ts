// Shared types for the import pipeline. Kept in a plain (non-'use server')
// module so both server actions and pure helpers can import them.

import type { TiptapDoc } from './html-to-tiptap'
import type { ImportFormat } from '@/lib/upload/validate-document'

export type { TiptapDoc, ImportFormat }

/** A single chapter detected from an imported file. */
export type ImportedChapter = {
  title: string
  /** TipTap doc for the chapter body (no title heading inside). */
  content: TiptapDoc
  wordCount: number
}

/**
 * Normalized output of parse-document, fed to split-chapters. Each format
 * produces the shape that maps most naturally to chapter boundaries.
 */
export type ParsedDocument =
  | { format: 'docx'; html: string; detectedTitle: string | null }
  | { format: 'epub'; sections: { title: string | null; html: string }[]; detectedTitle: string | null }
  | { format: 'pdf'; text: string; detectedTitle: string | null }

/** Preview payload returned by parseImportAction (no DB writes yet). */
export type ImportPreview = {
  chapters: ImportedChapter[]
  detectedTitle: string | null
}
