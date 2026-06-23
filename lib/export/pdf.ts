// PDF export.
//
// APPROACH / TRADE-OFF (documented per issue #43):
// We use `pdfkit` (the lighter of the two options the issue floated) rather
// than a headless-Chromium HTML->PDF renderer. Rationale:
//   - No headless browser => far smaller dependency + no cold-start / memory
//     blow-up on Vercel serverless (a Chromium binary is ~50MB+ and routinely
//     trips serverless time/memory limits on large books).
//   - pdfkit ships the standard-14 PDF fonts (Times-Roman / Helvetica and their
//     bold/italic variants) built in, so the "Times New Roman, manuscript"
//     preset needs ZERO font files bundled or registered.
//   - Running headers + page numbers are trivial via `bufferPages`.
//
// Cost of the choice: we render from the SAME per-chapter HTML the DOCX path
// builds (so content stays in lockstep across all three formats) by walking it
// with a small, purpose-built parser. The HTML vocabulary is bounded because we
// generate it ourselves (tiptapToHtml + the FBM templates), so a full HTML
// engine is unnecessary. Known v1 gap: <mark> (highlight) text is rendered
// without its background tint in PDF (the text itself is preserved, never
// dropped); DOCX and EPUB carry the highlight. Embedded <img> (about-author
// photo) is skipped in PDF v1.

import { tiptapToHtml, escapeHtml } from './tiptap-to-html'
import type { ChapterInput } from './docx'

export type PdfStyle = 'manuscript' | 'basic'

// ---------------------------------------------------------------------------
// Minimal HTML parser (bounded vocabulary, text already entity-escaped)
// ---------------------------------------------------------------------------

type ElNode = { tag: string; attrs: Record<string, string>; children: HtmlNode[] }
type TextNode = { text: string }
type HtmlNode = ElNode | TextNode

const VOID_TAGS = new Set(['br', 'hr', 'img'])
const TAG_RE = /<(\/?)([a-zA-Z0-9]+)((?:\s+[a-zA-Z-]+(?:="[^"]*"|='[^']*')?)*)\s*(\/?)>/g

function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z-]+)(?:=("[^"]*"|'[^']*'))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const key = m[1].toLowerCase()
    const val = m[2] ? m[2].slice(1, -1) : ''
    attrs[key] = val
  }
  return attrs
}

function parseHtml(html: string): HtmlNode[] {
  const root: ElNode = { tag: '#root', attrs: {}, children: [] }
  const stack: ElNode[] = [root]
  let lastIndex = 0
  let m: RegExpExecArray | null
  TAG_RE.lastIndex = 0
  while ((m = TAG_RE.exec(html)) !== null) {
    const between = html.slice(lastIndex, m.index)
    if (between.length > 0) {
      stack[stack.length - 1].children.push({ text: unescapeHtml(between) })
    }
    lastIndex = TAG_RE.lastIndex
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    const selfClosing = m[4] === '/' || VOID_TAGS.has(tag)
    if (closing) {
      // Pop until we find the matching open tag (tolerant of malformed nesting).
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i
          break
        }
      }
    } else {
      const el: ElNode = { tag, attrs: parseAttrs(m[3]), children: [] }
      stack[stack.length - 1].children.push(el)
      if (!selfClosing) stack.push(el)
    }
  }
  const tail = html.slice(lastIndex)
  if (tail.trim().length > 0) root.children.push({ text: unescapeHtml(tail) })
  return root.children
}

function isText(n: HtmlNode): n is TextNode {
  return (n as TextNode).text !== undefined
}

// ---------------------------------------------------------------------------
// Style parsing from inline `style="..."`
// ---------------------------------------------------------------------------

function styleMap(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  const raw = attrs.style
  if (!raw) return out
  for (const decl of raw.split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    out[decl.slice(0, idx).trim().toLowerCase()] = decl.slice(idx + 1).trim()
  }
  return out
}

// Convert a CSS length (pt / px / in) to points. Returns null if unparseable.
function lengthToPt(v: string | undefined): number | null {
  if (!v) return null
  const m = /^([\d.]+)\s*(pt|px|in)?$/.exec(v.trim())
  if (!m) return null
  const n = parseFloat(m[1])
  if (!isFinite(n)) return null
  switch (m[2]) {
    case 'in': return n * 72
    case 'px': return n * 0.75
    default: return n // pt or unitless
  }
}

// ---------------------------------------------------------------------------
// Inline run model
// ---------------------------------------------------------------------------

type InlineStyle = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  link?: string
  sizePt?: number
}
type Run = { text: string } & InlineStyle

const INLINE_TAGS = new Set([
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'code', 'span', 'a', 'br',
])

function collectRuns(nodes: HtmlNode[], style: InlineStyle, out: Run[]): void {
  for (const node of nodes) {
    if (isText(node)) {
      if (node.text.length > 0) out.push({ text: node.text, ...style })
      continue
    }
    if (node.tag === 'br') {
      out.push({ text: '\n', ...style })
      continue
    }
    const next: InlineStyle = { ...style }
    switch (node.tag) {
      case 'strong': case 'b': next.bold = true; break
      case 'em': case 'i': next.italic = true; break
      case 'u': next.underline = true; break
      case 's': case 'strike': case 'del': next.strike = true; break
      case 'code': next.code = true; break
      case 'a': {
        const href = node.attrs.href
        if (href) next.link = href
        break
      }
      case 'span': {
        const fs = lengthToPt(styleMap(node.attrs)['font-size'])
        if (fs) next.sizePt = fs
        break
      }
      // 'mark' (highlight): no visual style in v1, text still flows through.
    }
    collectRuns(node.children, next, out)
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

type Fonts = {
  body: string; bold: string; italic: string; boldItalic: string
  code: string; codeBold: string
}

const MANUSCRIPT_FONTS: Fonts = {
  body: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic',
  boldItalic: 'Times-BoldItalic', code: 'Courier', codeBold: 'Courier-Bold',
}
const BASIC_FONTS: Fonts = {
  body: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique',
  boldItalic: 'Helvetica-BoldOblique', code: 'Courier', codeBold: 'Courier-Bold',
}

function fontFor(s: Run, fonts: Fonts, baseBold: boolean, baseItalic: boolean): string {
  const bold = s.bold || baseBold
  const italic = s.italic || baseItalic
  if (s.code) return bold ? fonts.codeBold : fonts.code
  if (bold && italic) return fonts.boldItalic
  if (bold) return fonts.bold
  if (italic) return fonts.italic
  return fonts.body
}

type BlockOpts = {
  indent?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  baseBold?: boolean
  baseItalic?: boolean
  baseSizePt?: number
}

// PDFKit's document type is loaded dynamically; keep a loose alias.
type Doc = {
  addPage: () => Doc
  font: (f: string) => Doc
  fontSize: (n: number) => Doc
  fillColor: (c: string) => Doc
  text: (t: string, xOrOpts?: number | Record<string, unknown>, y?: number, opts?: Record<string, unknown>) => Doc
  moveDown: (n?: number) => Doc
  switchToPage: (n: number) => Doc
  bufferedPageRange: () => { start: number; count: number }
  on: (ev: string, cb: (...a: unknown[]) => void) => Doc
  end: () => void
  y: number
  page: { width: number; margins: { left: number; right: number } }
}

function emitParagraph(doc: Doc, runs: Run[], fonts: Fonts, baseSize: number, lineGap: number, opts: BlockOpts): void {
  const printable = runs.filter((r) => r.text.length > 0)
  if (printable.length === 0) {
    doc.moveDown(0.5)
    return
  }
  printable.forEach((run, i) => {
    const isLast = i === printable.length - 1
    const font = fontFor(run, fonts, !!opts.baseBold, !!opts.baseItalic)
    const size = run.sizePt ?? opts.baseSizePt ?? baseSize
    doc.font(font).fontSize(size).fillColor(run.code ? '#333333' : 'black')
    const textOpts: Record<string, unknown> = {
      continued: !isLast,
      lineGap,
      underline: !!run.underline,
      strike: !!run.strike,
    }
    if (run.link) textOpts.link = run.link
    if (i === 0) {
      if (opts.indent) textOpts.indent = opts.indent
      textOpts.align = opts.align ?? 'left'
    }
    doc.text(run.text, textOpts)
  })
  // Reset fill in case a code run left it gray.
  doc.fillColor('black')
}

function blockAlign(attrs: Record<string, string>): BlockOpts['align'] {
  const a = styleMap(attrs)['text-align']
  if (a === 'center' || a === 'right' || a === 'justify') return a
  return undefined
}

function renderContainer(
  doc: Doc,
  nodes: HtmlNode[],
  fonts: Fonts,
  baseSize: number,
  lineGap: number,
  firstParaIndent: number,
  isFirstBodyBlock: { value: boolean },
): void {
  for (const node of nodes) {
    if (isText(node)) {
      if (node.text.trim().length === 0) continue
      const runs: Run[] = [{ text: node.text }]
      emitParagraph(doc, runs, fonts, baseSize, lineGap, {})
      continue
    }
    const tag = node.tag
    if (INLINE_TAGS.has(tag)) {
      const runs: Run[] = []
      collectRuns([node], {}, runs)
      emitParagraph(doc, runs, fonts, baseSize, lineGap, {})
      continue
    }
    switch (tag) {
      case 'div': {
        const st = styleMap(node.attrs)
        const pad = lengthToPt(st['padding-top'])
        if (pad) doc.y += Math.min(pad, 216) // cap at 3in so we never overflow
        renderContainer(doc, node.children, fonts, baseSize, lineGap, firstParaIndent, isFirstBodyBlock)
        break
      }
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const runs: Run[] = []
        collectRuns(node.children, {}, runs)
        const level = parseInt(tag.slice(1), 10)
        const sizeFromStyle = lengthToPt(styleMap(node.attrs)['font-size'])
        const size = sizeFromStyle ?? Math.max(baseSize, baseSize + (4 - level) * 2)
        doc.moveDown(0.5)
        emitParagraph(doc, runs, fonts, baseSize, lineGap, {
          baseBold: true,
          baseSizePt: size,
          align: blockAlign(node.attrs) ?? (level === 1 ? 'center' : 'left'),
        })
        doc.moveDown(0.5)
        isFirstBodyBlock.value = true // next paragraph after a heading: no indent
        break
      }
      case 'p': {
        const runs: Run[] = []
        const st = styleMap(node.attrs)
        collectRuns(node.children, {}, runs)
        const indent = isFirstBodyBlock.value ? 0 : firstParaIndent
        emitParagraph(doc, runs, fonts, baseSize, lineGap, {
          indent,
          align: blockAlign(node.attrs),
          baseItalic: st['font-style'] === 'italic',
        })
        isFirstBodyBlock.value = false
        break
      }
      case 'blockquote': {
        for (const child of node.children) {
          if (isText(child)) continue
          const runs: Run[] = []
          collectRuns(child.children, {}, runs)
          emitParagraph(doc, runs, fonts, baseSize, lineGap, {
            indent: 36,
            baseItalic: true,
          })
        }
        doc.moveDown(0.3)
        isFirstBodyBlock.value = false
        break
      }
      case 'ul': case 'ol': {
        let n = 1
        for (const li of node.children) {
          if (isText(li) || li.tag !== 'li') continue
          const runs: Run[] = []
          // li usually wraps a <p>; flatten to inline runs.
          collectRuns(li.children, {}, runs)
          const marker = tag === 'ol' ? `${n}.  ` : '•  '
          runs.unshift({ text: marker })
          emitParagraph(doc, runs, fonts, baseSize, lineGap, { indent: 18 })
          n++
        }
        doc.moveDown(0.3)
        isFirstBodyBlock.value = false
        break
      }
      case 'pre': {
        const runs: Run[] = []
        collectRuns(node.children, { code: true }, runs)
        emitParagraph(doc, runs, fonts, baseSize, lineGap, { baseSizePt: baseSize - 1 })
        doc.moveDown(0.3)
        isFirstBodyBlock.value = false
        break
      }
      case 'hr': {
        doc.moveDown(0.5)
        emitParagraph(doc, [{ text: '*  *  *' }], fonts, baseSize, lineGap, { align: 'center' })
        doc.moveDown(0.5)
        isFirstBodyBlock.value = true
        break
      }
      case 'img':
        // Skipped in v1 (see module header).
        break
      default:
        // Unknown tag: render children transparently so nothing is lost.
        renderContainer(doc, node.children, fonts, baseSize, lineGap, firstParaIndent, isFirstBodyBlock)
    }
  }
}

export async function generatePdf(
  chapters: ChapterInput[],
  style: PdfStyle,
  bookTitle: string,
  authorName: string,
): Promise<Buffer> {
  // Dynamic import keeps pdfkit out of client bundles (mirrors html-to-docx).
  const PDFDocument = (await import('pdfkit')).default

  const isManuscript = style === 'manuscript'
  const fonts = isManuscript ? MANUSCRIPT_FONTS : BASIC_FONTS
  const baseSize = isManuscript ? 12 : 11
  const lineGap = isManuscript ? baseSize : 3 // double vs near-single spacing
  const firstParaIndent = isManuscript ? 36 : 0 // 0.5in first-line indent

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: bookTitle, Author: authorName },
  }) as unknown as Doc

  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', (e) => reject(e as Error))
  })

  for (const ch of chapters) {
    doc.addPage()
    doc.fillColor('black')
    const html = ch.htmlOverride ?? `<h1>${escapeHtml(ch.title)}</h1>${tiptapToHtml(ch.content)}`
    const nodes = parseHtml(html || '<p></p>')
    renderContainer(doc, nodes, fonts, baseSize, lineGap, firstParaIndent, { value: true })
  }

  // No pages got added (defensive — route guards empty books already).
  if (doc.bufferedPageRange().count === 0) doc.addPage()

  // Manuscript running header + page numbers (skip the first page).
  if (isManuscript) {
    const range = doc.bufferedPageRange()
    const headerText = `${authorName} / ${bookTitle}`
    for (let i = range.start; i < range.start + range.count; i++) {
      if (i === range.start) continue
      doc.switchToPage(i)
      const left = doc.page.margins.left
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
      doc.font('Times-Roman').fontSize(10).fillColor('black')
      doc.text(`${headerText}    ${i + 1}`, left, 40, { align: 'right', width, lineBreak: false })
    }
  }

  doc.end()
  return done
}
