import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hiveSuggestion: {
      setHiveSuggestion: (attrs: { suggestionId: string }) => ReturnType
      unsetHiveSuggestion: () => ReturnType
    }
  }
}

export const HiveSuggestionMark = Mark.create({
  name: 'hiveSuggestion',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-suggestion-id'),
        renderHTML: (a) =>
          a.suggestionId ? { 'data-suggestion-id': a.suggestionId } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-suggestion-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'hive-suggestion' }), 0]
  },
  addCommands() {
    return {
      setHiveSuggestion:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetHiveSuggestion:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
