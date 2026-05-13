type TiptapMark = { type: string }
type TiptapNode = {
  type: string
  text?: string
  marks?: TiptapMark[]
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(renderNode).join('')

    case 'paragraph':
      return `<p>${(node.content ?? []).map(renderNode).join('')}</p>`

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      return `<h${level}>${(node.content ?? []).map(renderNode).join('')}</h${level}>`
    }

    case 'text': {
      let html = escapeHtml(node.text ?? '')
      const marks = node.marks ?? []
      for (const mark of marks) {
        switch (mark.type) {
          case 'bold':      html = `<strong>${html}</strong>`; break
          case 'italic':    html = `<em>${html}</em>`; break
          case 'underline': html = `<u>${html}</u>`; break
          case 'strike':    html = `<s>${html}</s>`; break
          case 'highlight': html = `<mark>${html}</mark>`; break
        }
      }
      return html
    }

    case 'hardBreak':
      return '<br/>'

    case 'horizontalRule':
      return '<hr/>'

    case 'blockquote':
      return `<blockquote>${(node.content ?? []).map(renderNode).join('')}</blockquote>`

    case 'bulletList':
      return `<ul>${(node.content ?? []).map(renderNode).join('')}</ul>`

    case 'orderedList':
      return `<ol>${(node.content ?? []).map(renderNode).join('')}</ol>`

    case 'listItem':
      return `<li>${(node.content ?? []).map(renderNode).join('')}</li>`

    default:
      return (node.content ?? []).map(renderNode).join('')
  }
}

export function tiptapToHtml(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return ''
  return renderNode(doc as TiptapNode)
}
