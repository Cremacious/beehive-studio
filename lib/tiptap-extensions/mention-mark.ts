import { Mark, mergeAttributes } from '@tiptap/core'

export interface MentionAttrs {
  userId: string
  username: string
}

export interface MentionOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mentionMark: {
      setMention: (attrs: MentionAttrs) => ReturnType
      unsetMention: () => ReturnType
    }
  }
}

export const MentionMark = Mark.create<MentionOptions>({
  name: 'mention',
  inclusive: false,
  excludes: '',
  addOptions() {
    return { HTMLAttributes: {} }
  },
  addAttributes() {
    return {
      userId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mention-user-id'),
        renderHTML: (attrs) =>
          attrs.userId ? { 'data-mention-user-id': attrs.userId } : {},
      },
      username: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mention-username'),
        renderHTML: (attrs) =>
          attrs.username ? { 'data-mention-username': attrs.username } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-mention-user-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'mention',
      }),
      0,
    ]
  },
  addCommands() {
    return {
      setMention:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetMention:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
