// HTML -> TipTap JSON converter. The inverse of lib/export/tiptap-to-html.ts.
//
// CONTRACT: this emits ONLY the node/mark vocabulary the app's chapter editor
// renders, matching the export serializer so a Beehive doc that is exported and
// then re-imported preserves its supported formatting:
//
//   Nodes:  doc, paragraph, heading (levels 1-3; h4-h6 clamp to 3),
//           blockquote, bulletList, orderedList, listItem,
//           horizontalRule, hardBreak
//   Marks:  bold, italic, underline, strike, highlight, fontSize
//   Attrs:  textAlign on paragraph / heading (round-trips with the TextAlign ext)
//
// Anything outside this set is UNWRAPPED to its text content or dropped, never
// emitted as an unknown node. Specifically: links keep their text but drop the
// mark; inline <code> keeps its text but drops the mark; <pre>/code blocks become
// plain paragraphs; <table> cells flatten to paragraphs; <img> is dropped.
//
// The HTML tokenizer mirrors the bounded parser in lib/export/pdf.ts (regex
// tag-tokenizer + stack -> node tree, tolerant of malformed nesting). It is
// duplicated here deliberately so the load-bearing export path stays untouched.

// ─── Tokenizer (mirrors lib/export/pdf.ts) ──────────────────────────────────

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
    .replace(/&nbsp;/g, ' ')
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

// Strip <head>…</head>, comments, and script/style blocks before tokenizing so
// epub/docx wrapper markup doesn't leak into the body.
function stripNonBody(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '')
  out = out.replace(/<head[\s\S]*?<\/head>/gi, '')
  out = out.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  // If there's a <body>, keep only its contents.
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(out)
  if (body) return body[1]
  return out
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
  if (tail.length > 0) root.children.push({ text: unescapeHtml(tail) })
  return root.children
}

function isText(n: HtmlNode): n is TextNode {
  return (n as TextNode).text !== undefined
}

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

// ─── TipTap node model ──────────────────────────────────────────────────────

export type TiptapMark = { type: string; attrs?: Record<string, unknown> }
export type TiptapNode = {
  type: string
  text?: string
  marks?: TiptapMark[]
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
}
export type TiptapDoc = { type: 'doc'; content: TiptapNode[] }

type ActiveMarks = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  highlight?: boolean
  fontSize?: string
}

function marksToArray(m: ActiveMarks): TiptapMark[] {
  const out: TiptapMark[] = []
  if (m.bold) out.push({ type: 'bold' })
  if (m.italic) out.push({ type: 'italic' })
  if (m.underline) out.push({ type: 'underline' })
  if (m.strike) out.push({ type: 'strike' })
  if (m.highlight) out.push({ type: 'highlight' })
  if (m.fontSize) out.push({ type: 'fontSize', attrs: { size: m.fontSize } })
  return out
}

const INLINE_TAGS = new Set([
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark',
  'code', 'span', 'a', 'br', 'sub', 'sup', 'small', 'font',
])

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'ul', 'ol', 'li', 'hr', 'pre', 'table', 'thead', 'tbody',
  'tr', 'td', 'th',
])

// Collapse runs of whitespace (incl. newlines from source indentation) to a
// single space, the way an HTML renderer would for non-pre text.
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ')
}

// Walk inline content, accumulating marks, into TipTap inline nodes.
function collectInline(nodes: HtmlNode[], marks: ActiveMarks, out: TiptapNode[]): void {
  for (const node of nodes) {
    if (isText(node)) {
      const text = normalizeText(node.text)
      if (text.length === 0) continue
      const arr = marksToArray(marks)
      out.push(arr.length > 0 ? { type: 'text', text, marks: arr } : { type: 'text', text })
      continue
    }
    if (node.tag === 'br') {
      out.push({ type: 'hardBreak' })
      continue
    }
    // <img> and other void/unsupported inline nodes: dropped (text only).
    if (node.tag === 'img') continue

    const next: ActiveMarks = { ...marks }
    switch (node.tag) {
      case 'strong': case 'b': next.bold = true; break
      case 'em': case 'i': next.italic = true; break
      case 'u': next.underline = true; break
      case 's': case 'strike': case 'del': next.strike = true; break
      case 'mark': next.highlight = true; break
      case 'span': case 'font': {
        const fs = styleMap(node.attrs)['font-size']
        if (fs) next.fontSize = fs
        break
      }
      // 'code', 'a', 'sub', 'sup', 'small': mark dropped, text preserved.
    }
    collectInline(node.children, next, out)
  }
}

// Trim leading/trailing whitespace-only text nodes from an inline run so empty
// paragraphs stay empty and lines don't carry stray spaces.
function trimInline(nodes: TiptapNode[]): TiptapNode[] {
  const trimmed = [...nodes]
  while (trimmed.length > 0) {
    const first = trimmed[0]
    if (first.type === 'text' && first.text != null && first.text.trim().length === 0) {
      trimmed.shift()
    } else break
  }
  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1]
    if (last.type === 'text' && last.text != null && last.text.trim().length === 0) {
      trimmed.pop()
    } else break
  }
  return trimmed
}

function textAlignAttr(attrs: Record<string, string>): Record<string, unknown> | undefined {
  const align = styleMap(attrs)['text-align'] ?? attrs.align
  if (align === 'center' || align === 'right' || align === 'justify') {
    return { textAlign: align }
  }
  return undefined
}

function paragraph(children: HtmlNode[], attrs?: Record<string, string>): TiptapNode {
  const inline: TiptapNode[] = []
  collectInline(children, {}, inline)
  const content = trimInline(inline)
  const align = attrs ? textAlignAttr(attrs) : undefined
  const node: TiptapNode = { type: 'paragraph' }
  if (align) node.attrs = align
  if (content.length > 0) node.content = content
  return node
}

// ─── Block walker ───────────────────────────────────────────────────────────

function isBlockChild(nodes: HtmlNode[]): boolean {
  return nodes.some((n) => !isText(n) && BLOCK_TAGS.has(n.tag))
}

function walkBlocks(nodes: HtmlNode[], out: TiptapNode[]): void {
  // Buffer of consecutive inline nodes that should coalesce into one paragraph.
  let inlineBuffer: HtmlNode[] = []
  const flush = () => {
    if (inlineBuffer.length === 0) return
    const p = paragraph(inlineBuffer)
    if (p.content && p.content.length > 0) out.push(p)
    inlineBuffer = []
  }

  for (const node of nodes) {
    if (isText(node)) {
      if (normalizeText(node.text).trim().length > 0) inlineBuffer.push(node)
      continue
    }
    if (INLINE_TAGS.has(node.tag) && !BLOCK_TAGS.has(node.tag)) {
      inlineBuffer.push(node)
      continue
    }
    flush()
    emitBlock(node, out)
  }
  flush()
}

function emitBlock(node: ElNode, out: TiptapNode[]): void {
  const tag = node.tag
  switch (tag) {
    case 'p': {
      out.push(paragraph(node.children, node.attrs))
      break
    }
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const level = Math.min(parseInt(tag.slice(1), 10), 3)
      const inline: TiptapNode[] = []
      collectInline(node.children, {}, inline)
      const content = trimInline(inline)
      const attrs: Record<string, unknown> = { level, ...(textAlignAttr(node.attrs) ?? {}) }
      const heading: TiptapNode = { type: 'heading', attrs }
      if (content.length > 0) heading.content = content
      out.push(heading)
      break
    }
    case 'blockquote': {
      const inner: TiptapNode[] = []
      if (isBlockChild(node.children)) {
        walkBlocks(node.children, inner)
      } else {
        const p = paragraph(node.children)
        if (p.content && p.content.length > 0) inner.push(p)
      }
      if (inner.length === 0) inner.push({ type: 'paragraph' })
      out.push({ type: 'blockquote', content: inner })
      break
    }
    case 'ul': case 'ol': {
      const listType = tag === 'ul' ? 'bulletList' : 'orderedList'
      const items: TiptapNode[] = []
      for (const li of node.children) {
        if (isText(li) || li.tag !== 'li') continue
        const inner: TiptapNode[] = []
        if (isBlockChild(li.children)) {
          walkBlocks(li.children, inner)
        } else {
          inner.push(paragraph(li.children))
        }
        // A listItem must contain at least one block (an empty paragraph is fine).
        if (inner.length === 0) inner.push({ type: 'paragraph' })
        items.push({ type: 'listItem', content: inner })
      }
      if (items.length > 0) out.push({ type: listType, content: items })
      break
    }
    case 'hr': {
      out.push({ type: 'horizontalRule' })
      break
    }
    case 'pre': {
      // Code blocks aren't in the import target set; flatten to a paragraph
      // (text preserved, formatting dropped).
      out.push(paragraph(node.children))
      break
    }
    case 'table': case 'thead': case 'tbody': {
      // Flatten table structure: each row becomes a paragraph of joined cells.
      walkBlocks(node.children, out)
      break
    }
    case 'tr': {
      const cells: string[] = []
      for (const cell of node.children) {
        if (isText(cell)) continue
        if (cell.tag === 'td' || cell.tag === 'th') {
          const inline: TiptapNode[] = []
          collectInline(cell.children, {}, inline)
          const text = inline.map((n) => n.text ?? '').join('').trim()
          if (text.length > 0) cells.push(text)
        }
      }
      if (cells.length > 0) {
        out.push({ type: 'paragraph', content: [{ type: 'text', text: cells.join(' · ') }] })
      }
      break
    }
    case 'td': case 'th': {
      out.push(paragraph(node.children))
      break
    }
    default: {
      // div / section / article / unknown block: recurse transparently.
      walkBlocks(node.children, out)
    }
  }
}

/**
 * Convert an HTML string to a TipTap document, emitting only the supported
 * node/mark vocabulary. Always returns a valid `doc` (with at least one empty
 * paragraph if the input has no renderable content).
 */
export function htmlToTiptap(html: string): TiptapDoc {
  if (!html || typeof html !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }
  const nodes = parseHtml(stripNonBody(html))
  const content: TiptapNode[] = []
  walkBlocks(nodes, content)
  if (content.length === 0) content.push({ type: 'paragraph' })
  return { type: 'doc', content }
}
