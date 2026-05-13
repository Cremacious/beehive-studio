import JSZip from 'jszip'
import { tiptapToHtml, escapeHtml } from './tiptap-to-html'

export type EpubChapter = {
  title: string
  content: unknown // TipTap JSON
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function chapterXhtml(title: string, bodyHtml: string, cssPath: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" type="text/css" href="${cssPath}"/>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml || '<p></p>'}
</body>
</html>`
}

function containerXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
}

function contentOpf(
  uid: string,
  title: string,
  author: string,
  isbn: string | null,
  chapterIds: string[],
): string {
  const identifier = isbn ? `urn:isbn:${isbn}` : `urn:uuid:${uid}`
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
    ...chapterIds.map(id =>
      `<item id="${id}" href="chapters/${id}.xhtml" media-type="application/xhtml+xml"/>`
    ),
  ].join('\n    ')

  const spineItems = chapterIds
    .map(id => `<itemref idref="${id}"/>`)
    .join('\n    ')

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${identifier}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`
}

function navXhtml(chapters: { id: string; title: string }[]): string {
  const items = chapters
    .map(ch => `<li><a href="chapters/${ch.id}.xhtml">${escapeHtml(ch.title)}</a></li>`)
    .join('\n      ')

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head><meta charset="utf-8"/><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${items}
    </ol>
  </nav>
</body>
</html>`
}

const EPUB_CSS = `
body { font-family: Georgia, serif; font-size: 1em; line-height: 1.6; margin: 1em; }
h1 { font-size: 1.4em; margin: 2em 0 1em; }
p { margin: 0 0 0.75em; }
blockquote { margin: 1em 2em; font-style: italic; }
`

export async function generateEpub(
  chapters: EpubChapter[],
  bookTitle: string,
  authorName: string,
  isbn: string | null = null,
): Promise<Buffer> {
  const uid = crypto.randomUUID()
  const zip = new JSZip()

  // mimetype must be first and uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // META-INF
  zip.file('META-INF/container.xml', containerXml())

  // Build chapter list
  const chapterMeta: { id: string; title: string }[] = []
  const usedIds = new Set<string>()

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]
    let id = slugify(ch.title) || `chapter-${i + 1}`
    // Ensure unique ids
    if (usedIds.has(id)) id = `${id}-${i + 1}`
    usedIds.add(id)
    chapterMeta.push({ id, title: ch.title })

    const bodyHtml = tiptapToHtml(ch.content)
    zip.file(`OEBPS/chapters/${id}.xhtml`, chapterXhtml(ch.title, bodyHtml, '../styles.css'))
  }

  const chapterIds = chapterMeta.map(c => c.id)
  zip.file('OEBPS/content.opf', contentOpf(uid, bookTitle, authorName, isbn, chapterIds))
  zip.file('OEBPS/nav.xhtml', navXhtml(chapterMeta))
  zip.file('OEBPS/styles.css', EPUB_CSS)

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  return buffer
}
