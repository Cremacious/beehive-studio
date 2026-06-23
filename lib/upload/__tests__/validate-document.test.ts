import { describe, it, expect } from 'vitest'
import {
  validateDocumentFile,
  detectFormat,
  getExtension,
  DOCX_MIME,
  PDF_MIME,
  EPUB_MIME,
} from '../validate-document'

const MB = 1024 * 1024

describe('getExtension', () => {
  it('returns the lowercased extension', () => {
    expect(getExtension('Manuscript.DOCX')).toBe('docx')
    expect(getExtension('book.epub')).toBe('epub')
  })
  it('returns null when there is no extension', () => {
    expect(getExtension('noext')).toBeNull()
    expect(getExtension('trailingdot.')).toBeNull()
  })
})

describe('detectFormat', () => {
  it('detects by extension', () => {
    expect(detectFormat({ name: 'a.docx', type: '' })).toBe('docx')
    expect(detectFormat({ name: 'a.pdf', type: '' })).toBe('pdf')
    expect(detectFormat({ name: 'a.epub', type: '' })).toBe('epub')
  })
  it('falls back to MIME when the extension is unknown', () => {
    expect(detectFormat({ name: 'a.bin', type: DOCX_MIME })).toBe('docx')
    expect(detectFormat({ name: 'a', type: PDF_MIME })).toBe('pdf')
    expect(detectFormat({ name: 'a', type: EPUB_MIME })).toBe('epub')
  })
  it('returns null for unsupported types', () => {
    expect(detectFormat({ name: 'a.txt', type: 'text/plain' })).toBeNull()
  })
})

describe('validateDocumentFile', () => {
  it('accepts a valid docx', () => {
    expect(validateDocumentFile({ name: 'a.docx', type: DOCX_MIME, size: 2 * MB })).toBeNull()
  })

  it('rejects an unsupported type with a real message', () => {
    const err = validateDocumentFile({ name: 'a.txt', type: 'text/plain', size: 10 })
    expect(err).toBe('Only DOCX, PDF, and EPUB files are supported.')
  })

  it('rejects an empty file', () => {
    expect(validateDocumentFile({ name: 'a.pdf', type: PDF_MIME, size: 0 })).toBe('This file is empty.')
  })

  it('rejects an oversized file', () => {
    const err = validateDocumentFile({ name: 'a.pdf', type: PDF_MIME, size: 30 * MB })
    expect(err).toBe('File must be 25 MB or smaller.')
  })

  it('honors a custom max size', () => {
    const err = validateDocumentFile({ name: 'a.pdf', type: PDF_MIME, size: 6 * MB }, { maxSizeMb: 5 })
    expect(err).toBe('File must be 5 MB or smaller.')
  })

  it('honors an allowed-format restriction (append mode = docx + pdf)', () => {
    const err = validateDocumentFile(
      { name: 'a.epub', type: EPUB_MIME, size: MB },
      { allowedFormats: ['docx', 'pdf'] },
    )
    expect(err).toBe('Only DOCX and PDF files are supported.')
  })
})
