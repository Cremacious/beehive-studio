/**
 * Shared document-upload validation for the import feature. Both the client
 * (pre-upload check) and the server (re-validate before parsing) call this so
 * there is a single source of truth for which files we accept.
 *
 * Mirrors the shape of validate-image.ts. Returns a human-readable error string
 * or null when the file is valid.
 */

export type ImportFormat = 'docx' | 'pdf' | 'epub'

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const PDF_MIME = 'application/pdf'
export const EPUB_MIME = 'application/epub+zip'

export const ALL_IMPORT_FORMATS: readonly ImportFormat[] = ['docx', 'pdf', 'epub']

export const DEFAULT_MAX_DOCUMENT_SIZE_MB = 25

const EXT_TO_FORMAT: Record<string, ImportFormat> = {
  docx: 'docx',
  pdf: 'pdf',
  epub: 'epub',
}

// Browsers don't always set a reliable MIME for epub/docx, so we lead with the
// extension and accept the MIME as a secondary signal.
const FORMAT_MIMES: Record<ImportFormat, readonly string[]> = {
  docx: [DOCX_MIME],
  pdf: [PDF_MIME],
  epub: [EPUB_MIME],
}

export type ValidateDocumentOptions = {
  /** Default: 25 MB. */
  maxSizeMb?: number
  /** Restrict the accepted set (e.g. ['docx', 'pdf'] for append mode). Default: all three. */
  allowedFormats?: readonly ImportFormat[]
}

/** Lowercased file extension without the dot, or null if the name has none. */
export function getExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.')
  if (dot === -1 || dot === filename.length - 1) return null
  return filename.slice(dot + 1).toLowerCase()
}

/**
 * Resolves the import format from a file's name (primary) with the MIME type as
 * a fallback. Returns null when the file is not a supported document type.
 */
export function detectFormat(file: { name: string; type: string }): ImportFormat | null {
  const ext = getExtension(file.name)
  if (ext && EXT_TO_FORMAT[ext]) return EXT_TO_FORMAT[ext]

  // Fallback to MIME if the extension is missing or unrecognized.
  for (const format of ALL_IMPORT_FORMATS) {
    if (FORMAT_MIMES[format].includes(file.type)) return format
  }
  return null
}

function formatList(formats: readonly ImportFormat[]): string {
  const labels = formats.map((f) => f.toUpperCase())
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

/**
 * Validates a document upload. Returns an error message string, or null when
 * the file passes. Pure: no I/O, safe on both client and server.
 */
export function validateDocumentFile(
  file: { name: string; type: string; size: number },
  opts: ValidateDocumentOptions = {},
): string | null {
  const allowed = opts.allowedFormats ?? ALL_IMPORT_FORMATS
  const maxMb = opts.maxSizeMb ?? DEFAULT_MAX_DOCUMENT_SIZE_MB

  const format = detectFormat(file)
  if (!format || !allowed.includes(format)) {
    return `Only ${formatList(allowed)} files are supported.`
  }
  if (file.size === 0) {
    return 'This file is empty.'
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `File must be ${maxMb} MB or smaller.`
  }
  return null
}
