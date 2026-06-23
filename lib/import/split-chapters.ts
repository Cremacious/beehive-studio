// Heuristic chapter splitting. Turns a ParsedDocument into ImportedChapter[].
//
//   DOCX -> split the converted TipTap doc on top-level headings (level 1, or
//           level 2 if no level-1 headings exist). Heading text -> chapter title;
//           the heading node is stripped from the body (the binder item title
//           carries it, and export re-adds an <h1>).
//   EPUB -> one chapter per spine section (reading order preserved upstream).
//   PDF  -> split plain text on `Chapter N` lines / form feeds; fallback to a
//           single chapter. Pure text, no formatting.
//
// All splitting is pure and unit-testable.

import { htmlToTiptap, type TiptapDoc, type TiptapNode } from './html-to-tiptap'
import { extractWordCount } from '@/lib/tiptap-utils'
import type { ParsedDocument, ImportedChapter } from './types'

function nodeText(node: TiptapNode): string {
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(nodeText).join('')
}

function docFrom(nodes: TiptapNode[]): TiptapDoc {
  const content = nodes.length > 0 ? nodes : [{ type: 'paragraph' }]
  return { type: 'doc', content }
}

function hasRenderableText(nodes: TiptapNode[]): boolean {
  return nodes.some((n) => nodeText(n).trim().length > 0)
}

function makeChapter(title: string, nodes: TiptapNode[]): ImportedChapter {
  const content = docFrom(nodes)
  return { title, content, wordCount: extractWordCount(content) }
}

/** Fallback chapter title: "Chapter N" for a 1-based index. */
function fallbackTitle(index: number): string {
  return `Chapter ${index + 1}`
}

// Split a flat list of top-level TipTap nodes on heading nodes at `level`.
function splitOnHeadingLevel(content: TiptapNode[], level: number): ImportedChapter[] {
  const chapters: ImportedChapter[] = []
  let currentTitle: string | null = null
  let buffer: TiptapNode[] = []

  const commit = () => {
    // Skip empty trailing buffers, but always keep a chapter that has a title.
    if (currentTitle === null && !hasRenderableText(buffer)) {
      buffer = []
      return
    }
    const title = (currentTitle ?? '').trim() || fallbackTitle(chapters.length)
    chapters.push(makeChapter(title, buffer))
    buffer = []
  }

  for (const node of content) {
    if (node.type === 'heading' && (node.attrs?.level as number) === level) {
      // Close the previous section before starting a new one.
      if (currentTitle !== null || hasRenderableText(buffer)) commit()
      currentTitle = nodeText(node).trim() || fallbackTitle(chapters.length)
      continue
    }
    buffer.push(node)
  }
  commit()
  return chapters
}

function splitDocx(html: string, detectedTitle: string | null): ImportedChapter[] {
  const doc = htmlToTiptap(html)
  const content = doc.content
  const hasH1 = content.some((n) => n.type === 'heading' && (n.attrs?.level as number) === 1)
  const hasH2 = content.some((n) => n.type === 'heading' && (n.attrs?.level as number) === 2)
  const level = hasH1 ? 1 : hasH2 ? 2 : null

  if (level === null) {
    // No headings: single chapter.
    return [makeChapter((detectedTitle ?? '').trim() || 'Chapter 1', content)]
  }

  const chapters = splitOnHeadingLevel(content, level)
  return chapters.length > 0
    ? chapters
    : [makeChapter((detectedTitle ?? '').trim() || 'Chapter 1', content)]
}

function splitEpub(
  sections: { title: string | null; html: string }[],
  detectedTitle: string | null,
): ImportedChapter[] {
  const chapters: ImportedChapter[] = []
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const doc = htmlToTiptap(section.html)
    let nodes = doc.content
    let title = (section.title ?? '').trim()

    // If the section opens with a heading, use it as the title and strip it so
    // the body doesn't double the heading on re-export.
    const first = nodes[0]
    if (!title && first && first.type === 'heading') {
      title = nodeText(first).trim()
      nodes = nodes.slice(1)
    } else if (title && first && first.type === 'heading' && nodeText(first).trim() === title) {
      nodes = nodes.slice(1)
    }

    if (!title) title = fallbackTitle(i)
    if (nodes.length === 0 && !hasRenderableText(doc.content)) {
      // Empty section: skip unless it's the only one.
      if (sections.length > 1) continue
    }
    chapters.push(makeChapter(title, nodes))
  }
  if (chapters.length === 0 && detectedTitle) {
    chapters.push(makeChapter(detectedTitle, [{ type: 'paragraph' }]))
  }
  return chapters
}

const PDF_CHAPTER_RE = /^\s*(chapter\s+[\w\d]+|part\s+[\w\d]+|prologue|epilogue)\b.*$/i

function textToParagraphs(text: string): TiptapNode[] {
  // Split on blank lines into paragraphs; single newlines become spaces.
  return text
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter((block) => block.length > 0)
    .map((block) => ({ type: 'paragraph', content: [{ type: 'text', text: block }] }))
}

function splitPdf(text: string, detectedTitle: string | null): ImportedChapter[] {
  // Normalize line endings + form feeds (a common chapter-break signal).
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\f/g, '\n\n')
  const lines = normalized.split('\n')

  type Section = { title: string | null; lines: string[] }
  const sections: Section[] = []
  let current: Section = { title: null, lines: [] }

  for (const line of lines) {
    if (PDF_CHAPTER_RE.test(line) && line.trim().length <= 60) {
      // Start a new chapter at this heading line.
      if (current.title !== null || current.lines.some((l) => l.trim().length > 0)) {
        sections.push(current)
      }
      current = { title: line.trim(), lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.title !== null || current.lines.some((l) => l.trim().length > 0)) {
    sections.push(current)
  }

  if (sections.length === 0) {
    return [makeChapter((detectedTitle ?? '').trim() || 'Chapter 1', [{ type: 'paragraph' }])]
  }

  // If the only signal was leading content with no detected heading, it's a
  // single untitled chapter.
  if (sections.length === 1 && sections[0].title === null) {
    const paras = textToParagraphs(sections[0].lines.join('\n'))
    return [makeChapter((detectedTitle ?? '').trim() || 'Chapter 1', paras)]
  }

  return sections.map((section, i) => {
    const title = (section.title ?? '').trim() || fallbackTitle(i)
    const paras = textToParagraphs(section.lines.join('\n'))
    return makeChapter(title, paras)
  })
}

/** Split a parsed document into chapters using format-specific heuristics. */
export function splitChapters(parsed: ParsedDocument): ImportedChapter[] {
  switch (parsed.format) {
    case 'docx':
      return splitDocx(parsed.html, parsed.detectedTitle)
    case 'epub':
      return splitEpub(parsed.sections, parsed.detectedTitle)
    case 'pdf':
      return splitPdf(parsed.text, parsed.detectedTitle)
  }
}

/**
 * Merge all detected chapters into a single chapter, preserving order. Used
 * when the user picks "Import as a single chapter" in the preview. Each former
 * chapter title becomes a level-1 heading separating its body, except the first.
 */
export function mergeToSingleChapter(
  chapters: ImportedChapter[],
  title: string,
): ImportedChapter {
  const content: TiptapNode[] = []
  chapters.forEach((ch, i) => {
    if (i > 0) {
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: ch.title }],
      })
    }
    content.push(...ch.content.content)
  })
  const doc = docFrom(content)
  return { title, content: doc, wordCount: extractWordCount(doc) }
}
