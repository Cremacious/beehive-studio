import { escapeHtml } from './tiptap-to-html'
import type {
  TitlePageFields,
  CopyrightFields,
  DedicationFields,
  AcknowledgmentsFields,
  AboutAuthorFields,
} from '@/lib/front-back-matter/types'

// Each function returns an HTML string. The docx pipeline (lib/export/docx.ts)
// converts HTML to docx via html-to-docx; the epub pipeline embeds HTML directly.
// All user-supplied fields are HTML-escaped to prevent injection.

export function renderTitlePage(f: TitlePageFields): string {
  const parts: string[] = []
  parts.push(`<div style="text-align:center; page-break-after:always; padding-top:3in">`)
  parts.push(`<h1 style="font-size:24pt; margin:0 0 12pt 0">${escapeHtml(f.bookTitle)}</h1>`)
  if (f.subtitle) {
    parts.push(`<h2 style="font-size:14pt; font-style:italic; margin:0 0 48pt 0">${escapeHtml(f.subtitle)}</h2>`)
  }
  parts.push(`<p style="font-size:14pt; margin:0 0 48pt 0">${escapeHtml(f.authorName)}</p>`)
  if (f.publisherName) {
    parts.push(`<p style="font-size:11pt; margin-top:96pt">${escapeHtml(f.publisherName)}</p>`)
  }
  parts.push(`</div>`)
  return parts.join('\n')
}

export function renderCopyright(f: CopyrightFields): string {
  const parts: string[] = []
  parts.push(`<div style="page-break-after:always; padding-top:3in; font-size:10pt">`)
  parts.push(`<p>© ${f.copyrightYear} ${escapeHtml(f.copyrightHolder)}</p>`)
  if (f.publisherName) {
    parts.push(`<p>Published by ${escapeHtml(f.publisherName)}</p>`)
  }
  if (f.isbn) {
    parts.push(`<p>ISBN: ${escapeHtml(f.isbn)}</p>`)
  }
  if (f.extraNotice) {
    const escapedParagraphs = f.extraNotice
      .split(/\n\n+/)
      .map(p => `<p>${escapeHtml(p)}</p>`)
      .join('')
    parts.push(escapedParagraphs)
  } else {
    parts.push(`<p>All rights reserved.</p>`)
  }
  parts.push(`</div>`)
  return parts.join('\n')
}

export function renderDedication(f: DedicationFields): string {
  const paragraphs = f.text
    .split(/\n\n+/)
    .map(p =>
      `<p style="text-align:center; font-style:italic; margin:12pt 0">${escapeHtml(p)}</p>`,
    )
    .join('')
  return `<div style="page-break-after:always; padding-top:3in">${paragraphs}</div>`
}

export function renderAcknowledgments(f: AcknowledgmentsFields): string {
  const paragraphs = f.text
    .split(/\n\n+/)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('')
  return `<div style="page-break-after:always">
    <h1 style="font-size:14pt">Acknowledgments</h1>
    ${paragraphs}
  </div>`
}

export function renderAboutAuthor(f: AboutAuthorFields): string {
  const parts: string[] = []
  parts.push(`<div style="page-break-after:always">`)
  parts.push(`<h1 style="font-size:14pt">About the Author</h1>`)
  if (f.photoUrl) {
    parts.push(
      `<img src="${escapeHtml(f.photoUrl)}" alt="" style="max-width:2in; float:left; margin:0 12pt 6pt 0">`,
    )
  }
  const bioParas = f.bio
    .split(/\n\n+/)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('')
  parts.push(bioParas)
  if (f.links && f.links.length > 0) {
    const linkItems = f.links
      .map(
        l =>
          `<li>${escapeHtml(l.label)}: <a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a></li>`,
      )
      .join('')
    parts.push(`<ul>${linkItems}</ul>`)
  }
  parts.push(`</div>`)
  return parts.join('\n')
}
