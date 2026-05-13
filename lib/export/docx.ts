import { tiptapToHtml, escapeHtml } from './tiptap-to-html'

export type DocxStyle = 'manuscript' | 'basic'

export type ChapterInput = {
  title: string
  content: unknown // TipTap JSON
}

const MANUSCRIPT_CSS = `
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 2; margin: 72pt; }
  h1 { font-size: 14pt; text-align: center; margin-bottom: 24pt; page-break-before: always; }
  p { margin: 0; text-indent: 0.5in; }
  p:first-of-type { text-indent: 0; }
`

const BASIC_CSS = `
  body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; margin: 72pt; }
  h1 { font-size: 13pt; margin-bottom: 12pt; page-break-before: always; }
  p { margin: 0 0 6pt 0; }
`

function chaptersToHtml(chapters: ChapterInput[], css: string): string {
  const body = chapters
    .map(ch => {
      const content = tiptapToHtml(ch.content)
      return `<h1>${escapeHtml(ch.title)}</h1>${content || '<p></p>'}`
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${body}</body></html>`
}

export async function generateDocx(
  chapters: ChapterInput[],
  style: DocxStyle,
  bookTitle: string,
  authorName: string,
): Promise<Buffer> {
  // Dynamic import avoids shipping to client bundles
  const HTMLtoDOCX = (await import('html-to-docx')).default

  const css = style === 'manuscript' ? MANUSCRIPT_CSS : BASIC_CSS
  const html = chaptersToHtml(chapters, css)

  const headerHtml =
    style === 'manuscript'
      ? `<p style="text-align:right">${authorName} / ${bookTitle}</p>`
      : null

  const options = {
    title: bookTitle,
    creator: authorName,
    header: style === 'manuscript',
    // pageNumber requires footer to be enabled per docs
    footer: style === 'manuscript',
    pageNumber: style === 'manuscript',
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch in twips
    font: style === 'manuscript' ? 'Times New Roman' : 'Calibri',
    fontSize: style === 'manuscript' ? 24 : 22, // half-points: 24 = 12pt, 22 = 11pt
  }

  const result = await HTMLtoDOCX(html, headerHtml, options, null)

  // html-to-docx may return Buffer or Blob depending on environment
  if (Buffer.isBuffer(result)) return result
  if (result instanceof Blob) {
    const arrayBuffer = await result.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  return Buffer.from(result as ArrayBuffer)
}
