import { Mark, mergeAttributes } from '@tiptap/core'

export type AnnotationLayer = 'GRAMMAR' | 'PLOT' | 'TONE' | 'CONTINUITY' | 'GENERAL'

export interface HiveAnnotationOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hiveAnnotation: {
      setHiveAnnotation: (attrs: { annotationId: string; layer: AnnotationLayer }) => ReturnType
      unsetHiveAnnotation: (annotationId: string) => ReturnType
    }
  }
}

export const HiveAnnotationMark = Mark.create<HiveAnnotationOptions>({
  name: 'hiveAnnotation',
  inclusive: false,
  excludes: '',
  addOptions() {
    return { HTMLAttributes: {} }
  },
  addAttributes() {
    return {
      annotationId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-annotation-id'),
        renderHTML: (a) =>
          a.annotationId ? { 'data-annotation-id': a.annotationId } : {},
      },
      layer: {
        default: 'GENERAL',
        parseHTML: (el) => el.getAttribute('data-layer') ?? 'GENERAL',
        renderHTML: (a) => ({ 'data-layer': a.layer }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-annotation-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'hive-annotation' }),
      0,
    ]
  },
  addCommands() {
    return {
      setHiveAnnotation:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetHiveAnnotation:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
