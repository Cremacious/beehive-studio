'use client'
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

type State =
  | { kind: 'idle' }
  | { kind: 'active'; from: number; query: string; anchorRect: DOMRect }

export function useMentionPopover(editor: Editor | null) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!editor) return

    const onUpdate = () => {
      const { from } = editor.state.selection
      const docText = editor.state.doc.textBetween(0, from, ' ', ' ')
      // Find the last @ in the trailing word.
      const tail = docText.split(/\s/).pop() ?? ''
      const current = stateRef.current
      if (tail.startsWith('@')) {
        const query = tail.slice(1)
        try {
          const coords = editor.view.coordsAtPos(from - tail.length)
          const anchorRect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
          setState({ kind: 'active', from: from - tail.length, query, anchorRect })
        } catch {
          /* ignore */
        }
      } else if (current.kind === 'active') {
        setState({ kind: 'idle' })
      }
    }

    const onBlur = () => setState({ kind: 'idle' })

    editor.on('update', onUpdate)
    editor.on('selectionUpdate', onUpdate)
    editor.on('blur', onBlur)
    return () => {
      editor.off('update', onUpdate)
      editor.off('selectionUpdate', onUpdate)
      editor.off('blur', onBlur)
    }
  }, [editor])

  const close = () => setState({ kind: 'idle' })

  const insertMention = (userId: string, username: string) => {
    if (!editor || state.kind !== 'active') return
    // Replace the @query text with the mention mark wrapping @username.
    const queryLen = 1 + state.query.length // include @
    editor
      .chain()
      .focus()
      .deleteRange({ from: state.from, to: state.from + queryLen })
      .insertContent({
        type: 'text',
        text: `@${username}`,
        marks: [{ type: 'mention', attrs: { userId, username } }],
      })
      .insertContent(' ')
      .run()
    close()
  }

  return {
    isActive: state.kind === 'active',
    query: state.kind === 'active' ? state.query : '',
    anchorRect: state.kind === 'active' ? state.anchorRect : null,
    close,
    insertMention,
  }
}
