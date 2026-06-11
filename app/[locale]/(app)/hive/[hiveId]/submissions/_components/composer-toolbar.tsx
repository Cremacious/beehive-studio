'use client'

import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
} from 'lucide-react'

type Props = {
  editor: Editor | null
}

/**
 * Minimal rich-text toolbar for the submission composer. Matches the studio
 * editor's tile-button chrome (--canvas-dark-350 → -300 gradient, brand-yellow
 * active state, --r-btn radius) but flat — no dropdowns, no editor-context
 * dependency. Hidden when editor is missing or non-editable.
 */
export function ComposerToolbar({ editor }: Props) {
  if (!editor || !editor.isEditable) return null

  const promptLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run()
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1.5 px-2 py-2"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        border: 'var(--br-card)',
        borderRadius: 'var(--r-card) var(--r-card) 0 0',
        borderBottom: '1px solid oklch(from var(--canvas-dark-300) l c h / 0.6)',
      }}
    >
      {/* Inline marks */}
      <Group>
        <Btn
          title="Bold (Ctrl+B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn
          title="Italic (Ctrl+I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Btn>
        <Btn
          title="Underline (Ctrl+U)"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Btn>
        <Btn
          title="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </Btn>
        <Btn
          title="Highlight"
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
        </Btn>
        <Btn
          title="Link"
          active={editor.isActive('link')}
          onClick={promptLink}
        >
          <Link2 className="h-4 w-4" />
        </Btn>
      </Group>

      <Sep />

      {/* Block types */}
      <Group>
        <Btn
          title="Paragraph"
          active={
            editor.isActive('paragraph') &&
            !editor.isActive('heading', { level: 1 }) &&
            !editor.isActive('heading', { level: 2 }) &&
            !editor.isActive('heading', { level: 3 })
          }
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </Btn>
        <Btn
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="h-4 w-4" />
        </Btn>
        <Btn
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </Btn>
        <Btn
          title="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-4 w-4" />
        </Btn>
      </Group>

      <Sep />

      {/* Lists + structure */}
      <Group>
        <Btn
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Btn>
        <Btn
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <Btn
          title="Blockquote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Btn>
        <Btn
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </Btn>
      </Group>

      <Sep />

      {/* Alignment */}
      <Group>
        <Btn
          title="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Btn>
        <Btn
          title="Align center"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Btn>
        <Btn
          title="Align right"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </Btn>
      </Group>

      <Sep />

      {/* History */}
      <Group>
        <Btn
          title="Undo (Ctrl+Z)"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </Btn>
        <Btn
          title="Redo (Ctrl+Shift+Z)"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </Btn>
      </Group>
    </div>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>
}

function Sep() {
  return (
    <span
      aria-hidden
      className="mx-1 h-5 w-px"
      style={{
        background: 'oklch(from var(--canvas-dark-300) l c h / 0.7)',
      }}
    />
  )
}

type BtnProps = {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function Btn({ title, active = false, disabled = false, onClick, children }: BtnProps) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      // Don't steal focus from the editor on press — node-level commands
      // (heading, list, blockquote, link) need the editor selection alive.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-[30px] w-[30px] items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderRadius: 'var(--r-btn)',
        background: active
          ? 'var(--brand)'
          : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        color: active ? '#1a1a1a' : 'var(--brand)',
      }}
      onMouseEnter={(e) => {
        if (active || disabled) return
        e.currentTarget.style.background =
          'linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))'
      }}
      onMouseLeave={(e) => {
        if (active || disabled) return
        e.currentTarget.style.background =
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
      }}
    >
      {children}
    </button>
  )
}
