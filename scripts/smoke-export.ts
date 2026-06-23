// Dev-only smoke: generate all three export formats from a representative book
// (front + back matter, a nested part for reading order, and every mark type)
// so a human can open the files and eyeball them. Not part of the test suite.
//
//   npx tsx scripts/smoke-export.ts
//
// Outputs to ./tmp-export/.

import { mkdirSync, writeFileSync } from 'fs'
import { generatePdf } from '../lib/export/pdf'
import { generateDocx } from '../lib/export/docx'
import { generateEpub } from '../lib/export/epub'
import { buildExportInputs, type ExportRow } from '../lib/export/build-export-inputs'

const now = new Date('2026-06-23')

function row(p: Partial<ExportRow>): ExportRow {
  return {
    id: 'id', parentId: null, type: 'chapter', title: null, order: 0,
    chapterId: null, chapterContent: null, chapterStatus: 'FINAL',
    chapterUpdatedAt: now, binderContent: null, ...p,
  }
}

const richChapter = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [{ type: 'text', text: 'A Centered Subheading' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'This paragraph has ' },
      { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: ', ' },
      { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
      { type: 'text', text: ', ' },
      { type: 'text', text: 'underline', marks: [{ type: 'underline' }] },
      { type: 'text', text: ', ' },
      { type: 'text', text: 'strikethrough', marks: [{ type: 'strike' }] },
      { type: 'text', text: ', ' },
      { type: 'text', text: 'highlight', marks: [{ type: 'highlight' }] },
      { type: 'text', text: ', ' },
      { type: 'text', text: 'inline code', marks: [{ type: 'code' }] },
      { type: 'text', text: ', a ' },
      { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
      { type: 'text', text: ', and ' },
      { type: 'text', text: 'big text', marks: [{ type: 'fontSize', attrs: { size: '24px' } }] },
      { type: 'text', text: '.' },
    ] },
    { type: 'paragraph', content: [{ type: 'text', text: 'A second paragraph to confirm first-line indentation only applies after the first.' }] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A blockquote, rendered italic and indented.' }] }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First bullet' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second bullet' }] }] },
    ] },
    { type: 'orderedList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Numbered one' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Numbered two' }] }] },
    ] },
    { type: 'horizontalRule' },
    { type: 'paragraph', content: [{ type: 'text', text: 'After a scene break.' }] },
  ],
}

const rows: ExportRow[] = [
  row({ id: 'fm-title', type: 'front_matter', title: 'Title Page', order: 0,
    binderContent: { subtype: 'title_page', fields: { bookTitle: 'The Smoke Test', subtitle: 'A Verification', authorName: 'Chris Mackall' } } }),
  row({ id: 'fm-ded', type: 'front_matter', title: 'Dedication', order: 1,
    binderContent: { subtype: 'dedication', fields: { text: 'For everyone who clicked Export.' } } }),
  row({ id: 'c-intro', type: 'chapter', title: 'Introduction', order: 2, chapterId: 'ch0',
    chapterContent: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A root-level chapter that should come before Part One in reading order.' }] }] } }),
  row({ id: 'p1', type: 'part', title: 'Part One', order: 3 }),
  row({ id: 'c-a', parentId: 'p1', type: 'chapter', title: 'Chapter A', order: 1, chapterId: 'cha', chapterContent: richChapter }),
  row({ id: 'c-b', parentId: 'p1', type: 'chapter', title: 'Chapter B', order: 2, chapterId: 'chb',
    chapterContent: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Chapter B, nested under Part One.' }] }] } }),
  row({ id: 'c-empty', type: 'chapter', title: 'Empty Chapter (should be skipped)', order: 4, chapterId: 'che', chapterContent: { type: 'doc', content: [{ type: 'paragraph' }] } }),
  row({ id: 'bm-ack', type: 'back_matter', title: 'Acknowledgments', order: 5,
    binderContent: { subtype: 'acknowledgments', fields: { text: 'Thanks to the test suite.' } } }),
]

async function main() {
  const { all, chapters } = buildExportInputs(rows)
  console.log(`Reading order (${chapters.length} chapters, ${all.length} total sections):`)
  for (const s of all) console.log(`  - ${s.htmlOverride ? '[FBM] ' : ''}${s.title}`)

  mkdirSync('tmp-export', { recursive: true })

  const pdf = await generatePdf(all, 'manuscript', 'The Smoke Test', 'Chris Mackall')
  writeFileSync('tmp-export/smoke-manuscript.pdf', pdf)
  console.log(`\nPDF manuscript: ${pdf.length} bytes, magic=${pdf.subarray(0, 5).toString('latin1')}`)

  const pdfBasic = await generatePdf(all, 'basic', 'The Smoke Test', 'Chris Mackall')
  writeFileSync('tmp-export/smoke-basic.pdf', pdfBasic)
  console.log(`PDF basic: ${pdfBasic.length} bytes`)

  const docx = await generateDocx(all, 'manuscript', 'The Smoke Test', 'Chris Mackall')
  writeFileSync('tmp-export/smoke.docx', docx)
  console.log(`DOCX: ${docx.length} bytes`)

  const epub = await generateEpub(all, 'The Smoke Test', 'Chris Mackall', '978-0-00-000000-0')
  writeFileSync('tmp-export/smoke.epub', epub)
  console.log(`EPUB: ${epub.length} bytes`)

  console.log('\nWrote files to ./tmp-export/ — open them to verify.')
}

main().catch((e) => { console.error(e); process.exit(1) })
