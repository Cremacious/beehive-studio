// Per-format document parsers. SERVER-ONLY: heavy deps (mammoth, pdfjs-dist,
// jszip) are dynamic-imported so they never reach the client bundle, mirroring
// the export path (html-to-docx / pdfkit are imported the same way).
//
// Each parser returns a normalized ParsedDocument (or throws a typed
// ImportError that the action layer maps to a clean user-facing message).
// No parser ever throws an unhandled error to the route/action.

import type { ParsedDocument, ImportFormat } from './types'

/** Typed error so the action layer can surface the real reason to the modal. */
export class ImportError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ImportError'
  }
}

// ─── DOCX (mammoth) ─────────────────────────────────────────────────────────

function firstHeadingText(html: string): string | null {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  if (!m) return null
  const text = m[1].replace(/<[^>]+>/g, '').trim()
  return text.length > 0 ? text : null
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  let html: string
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ buffer })
    html = result.value
  } catch {
    throw new ImportError('PARSE_FAILED', "We couldn't read this file. It may be corrupted.")
  }
  if (!html || html.replace(/<[^>]+>/g, '').trim().length === 0) {
    throw new ImportError('EMPTY', 'No readable text found in this file.')
  }
  return { format: 'docx', html, detectedTitle: firstHeadingText(html) }
}

// ─── EPUB (jszip + OPF spine) ───────────────────────────────────────────────

function xmlAttr(tag: string, attr: string): string | null {
  const m = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)
  return m ? m[1] : null
}

function resolveHref(opfPath: string, href: string): string {
  // Resolve a manifest href relative to the OPF file's directory.
  const cleaned = href.split('#')[0]
  const dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const combined = (dir + cleaned).split('/')
  const stack: string[] = []
  for (const part of combined) {
    if (part === '.' || part === '') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

function extractBody(xhtml: string): string {
  const m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(xhtml)
  return m ? m[1] : xhtml
}

function firstHeadingTitle(bodyHtml: string): string | null {
  const m = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(bodyHtml)
  if (!m) return null
  const text = m[1].replace(/<[^>]+>/g, '').trim()
  return text.length > 0 ? text : null
}

async function parseEpub(buffer: Buffer): Promise<ParsedDocument> {
  const JSZip = (await import('jszip')).default
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new ImportError('PARSE_FAILED', "We couldn't read this file. It may be corrupted.")
  }

  // Encrypted / DRM epubs ship an encryption.xml in META-INF.
  if (zip.file('META-INF/encryption.xml')) {
    throw new ImportError('ENCRYPTED', "This EPUB is encrypted and can't be imported.")
  }

  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) {
    throw new ImportError('PARSE_FAILED', "This EPUB is missing its container file and can't be read.")
  }
  const container = await containerFile.async('text')
  const rootfile = /<rootfile[^>]*full-path\s*=\s*"([^"]+)"/i.exec(container)
  if (!rootfile) {
    throw new ImportError('PARSE_FAILED', "This EPUB has no readable package file.")
  }
  const opfPath = rootfile[1]
  const opfFile = zip.file(opfPath)
  if (!opfFile) {
    throw new ImportError('PARSE_FAILED', "This EPUB's package file is missing.")
  }
  const opf = await opfFile.async('text')

  // Title from dc:title.
  const titleMatch = /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opf)
  const detectedTitle = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, '').trim() || null
    : null

  // Manifest: id -> href (for HTML/XHTML items).
  const manifest = new Map<string, string>()
  const itemRe = /<item\b([^>]*)\/?>/gi
  let im: RegExpExecArray | null
  while ((im = itemRe.exec(opf)) !== null) {
    const tag = im[1]
    const id = xmlAttr(tag, 'id')
    const href = xmlAttr(tag, 'href')
    const mediaType = xmlAttr(tag, 'media-type') ?? ''
    if (id && href && /xhtml|html/.test(mediaType)) {
      manifest.set(id, href)
    }
  }

  // Spine: ordered idrefs (reading order).
  const spineIds: string[] = []
  const spineRe = /<itemref\b([^>]*)\/?>/gi
  let sm: RegExpExecArray | null
  while ((sm = spineRe.exec(opf)) !== null) {
    const idref = xmlAttr(sm[1], 'idref')
    const linear = xmlAttr(sm[1], 'linear')
    if (idref && linear !== 'no') spineIds.push(idref)
  }

  const sections: { title: string | null; html: string }[] = []
  for (const id of spineIds) {
    const href = manifest.get(id)
    if (!href) continue
    const path = resolveHref(opfPath, href)
    const file = zip.file(path)
    if (!file) continue
    const xhtml = await file.async('text')
    const body = extractBody(xhtml)
    if (body.replace(/<[^>]+>/g, '').trim().length === 0) continue
    sections.push({ title: firstHeadingTitle(body), html: body })
  }

  if (sections.length === 0) {
    throw new ImportError('EMPTY', 'No readable text found in this file.')
  }
  return { format: 'epub', sections, detectedTitle }
}

// ─── PDF (pdfjs-dist) ───────────────────────────────────────────────────────

// Loose surface for the bits of pdfjs we touch — avoids depending on the
// package's .mts type resolution (mirrors the loose Doc alias in pdf.ts).
type PdfTextItem = { str?: string; hasEOL?: boolean }
type PdfPage = { getTextContent: () => Promise<{ items: PdfTextItem[] }> }
type PdfDoc = {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
  getMetadata: () => Promise<{ info?: { Title?: string } }>
}
type PdfjsModule = {
  getDocument: (opts: {
    data: Uint8Array
    useSystemFonts?: boolean
    disableFontFace?: boolean
    isEvalSupported?: boolean
  }) => { promise: Promise<PdfDoc> }
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  let pdfjs: PdfjsModule
  try {
    pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsModule
  } catch {
    throw new ImportError('PARSE_FAILED', "We couldn't load the PDF reader.")
  }

  const data = new Uint8Array(buffer)
  let pdf: PdfDoc
  try {
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      // Run on the main thread; no worker file in the Node/serverless runtime.
      disableFontFace: true,
      isEvalSupported: false,
    })
    pdf = await loadingTask.promise
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'PasswordException') {
      throw new ImportError('ENCRYPTED', "This PDF is password protected and can't be imported.")
    }
    throw new ImportError('PARSE_FAILED', "We couldn't read this file. It may be corrupted.")
  }

  // Title from PDF metadata if present.
  let detectedTitle: string | null = null
  try {
    const meta = await pdf.getMetadata()
    const info = meta?.info
    if (info?.Title && info.Title.trim().length > 0) detectedTitle = info.Title.trim()
  } catch {
    // Metadata is optional; ignore failures.
  }

  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let pageText = ''
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue
      pageText += item.str
      if (item.hasEOL) pageText += '\n'
    }
    pageTexts.push(pageText)
  }

  const text = pageTexts.join('\n\n').trim()
  if (text.length === 0) {
    throw new ImportError(
      'NO_TEXT',
      "This PDF has no selectable text. Scanned PDFs aren't supported yet.",
    )
  }
  return { format: 'pdf', text, detectedTitle }
}

/**
 * Parse a document buffer into the normalized intermediate. Throws ImportError
 * with a typed code + user-facing message on any failure.
 */
export async function parseDocument(buffer: Buffer, format: ImportFormat): Promise<ParsedDocument> {
  switch (format) {
    case 'docx':
      return parseDocx(buffer)
    case 'epub':
      return parseEpub(buffer)
    case 'pdf':
      return parsePdf(buffer)
  }
}
