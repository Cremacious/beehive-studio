type TiptapMark = { type: string; attrs?: Record<string, unknown> }
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
          case 'fontSize': {
            const size = mark.attrs?.size
            if (typeof size === 'string' && size.length > 0) {
              html = `<span style="font-size: ${escapeHtml(size)}">${html}</span>`
            }
            break
          }
          case 'textStyle': {
            // Legacy: earlier sessions saved bare `textStyle` marks (or with
            // a `fontSize` attr) before we switched to a standalone mark.
            // Preserve any fontSize attr if present; otherwise render as a
            // plain pass-through (no wrapping span).
            const legacySize = mark.attrs?.fontSize
            if (typeof legacySize === 'string' && legacySize.length > 0) {
              html = `<span style="font-size: ${escapeHtml(legacySize)}">${html}</span>`
            }
            break
          }
          case 'hiveAnnotation': {
            const id = mark.attrs?.annotationId
            const layer = mark.attrs?.layer
            if (typeof id === 'string') {
              const layerAttr = typeof layer === 'string' ? ` data-layer="${escapeHtml(layer)}"` : ''
              html = `<span class="hive-annotation" data-annotation-id="${escapeHtml(id)}"${layerAttr}>${html}</span>`
            }
            break
          }
          case 'hiveSuggestion': {
            const id = mark.attrs?.suggestionId
            if (typeof id === 'string') {
              html = `<span class="hive-suggestion" data-suggestion-id="${escapeHtml(id)}">${html}</span>`
            }
            break
          }
          case 'mention': {
            const userId = mark.attrs?.userId
            const username = mark.attrs?.username
            if (typeof username === 'string') {
              const userIdAttr = typeof userId === 'string' ? ` data-mention-user-id="${escapeHtml(userId)}"` : ''
              html = `<a href="/u/${escapeHtml(username)}" class="mention"${userIdAttr}>${html}</a>`
            }
            break
          }
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
