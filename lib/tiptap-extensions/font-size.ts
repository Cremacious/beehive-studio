// Inline font-size mark. Lets the editor apply per-selection font sizes the
// way Word and Google Docs do.
//
// Stored as `<span style="font-size: Npx">text</span>` in the rendered HTML
// and as `{ type: 'fontSize', attrs: { size: 'Npx' } }` in the saved
// TipTap JSON.
//
// Implementation note: applies the mark via a direct ProseMirror transaction
// (state.tr.addMark / removeMark) instead of `commands.setMark`. The TipTap
// command wrapper was dropping the `size` attr at the schema layer for
// reasons we couldn't pin down — the direct path is what actually persists.

import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSizeMark = Mark.create({
  name: 'fontSize',
  inclusive: true,

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (el) => {
          const v = (el as HTMLElement).style?.fontSize?.trim()
          return v && v.length > 0 ? v : null
        },
        renderHTML: (attrs) => {
          const size = (attrs as { size?: string | null }).size
          if (!size) return {}
          return { style: `font-size: ${size}` }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        style: 'font-size',
        getAttrs: (value) => {
          const v = String(value).trim()
          return v ? { size: v } : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ state, dispatch, tr }) => {
          const markType = state.schema.marks.fontSize
          if (!markType) return false
          const { from, to, empty } = state.selection
          if (empty) return false
          if (dispatch) {
            tr.removeMark(from, to, markType)
            tr.addMark(from, to, markType.create({ size }))
            dispatch(tr)
          }
          return true
        },
      unsetFontSize:
        () =>
        ({ state, dispatch, tr }) => {
          const markType = state.schema.marks.fontSize
          if (!markType) return false
          const { from, to, empty } = state.selection
          if (empty) return false
          if (dispatch) {
            tr.removeMark(from, to, markType)
            dispatch(tr)
          }
          return true
        },
    }
  },
})
