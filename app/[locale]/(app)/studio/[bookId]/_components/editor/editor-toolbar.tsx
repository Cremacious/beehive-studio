'use client'

import { cn } from '@/lib/utils'
import type { Editor } from '@tiptap/react'
// Side-effect import: pulls in module augmentations for all StarterKit commands
import '@tiptap/starter-kit'
import { useBookEditor } from '../book-editor-provider'
import type { CharacterCountStorage } from '@tiptap/extensions'

type Props = {
  editor: Editor
}

type ToolbarButtonProps = {
  onClick: () => void
  disabled?: boolean
  isActive?: boolean
  children: React.ReactNode
}

function ToolbarButton({ onClick, disabled, isActive, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'text-xs px-2 py-1 rounded transition-colors',
        'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
        isActive && 'bg-brand/20 text-brand',
      )}
    >
      {children}
    </button>
  )
}

function Separator() {
  return <span className="w-px h-4 bg-border mx-1" />
}

export function EditorToolbar({ editor }: Props) {
  const { saveStatus, wordCount, focusMode, toggleFocusMode } = useBookEditor()

  function handleLinkClick() {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
    } else {
      const url = window.prompt('URL')
      if (url) editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const charCount = editor.storage.characterCount as CharacterCountStorage | undefined

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-surface">
      {/* Inline */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
      >
        S
      </ToolbarButton>

      <Separator />

      {/* Block */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
      >
        H3
      </ToolbarButton>

      <Separator />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={!editor.can().chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
      >
        ≡
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={!editor.can().chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
      >
        1.
      </ToolbarButton>

      {/* Other */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        disabled={!editor.can().chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
      >
        "
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        —
      </ToolbarButton>

      <Separator />

      {/* History */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        ↺
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        ↻
      </ToolbarButton>

      <Separator />

      {/* Format: Underline, Highlight, Link */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
      >
        <span style={{ textDecoration: 'underline' }}>U</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
      >
        H
      </ToolbarButton>
      <ToolbarButton
        onClick={handleLinkClick}
        isActive={editor.isActive('link')}
      >
        🔗
      </ToolbarButton>

      <Separator />

      {/* Align */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
      >
        ≡
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
      >
        ≡
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
      >
        ≡
      </ToolbarButton>

      <span className="flex-1" />

      {/* Save status + word count */}
      <span className="flex items-center gap-2 text-xs text-foreground/40">
        <span
          className={cn(
            'flex items-center gap-1',
            saveStatus === 'unsaved' && 'text-brand',
            saveStatus === 'saving' && 'text-foreground/40 animate-pulse',
          )}
        >
          {saveStatus === 'saved' && '● Saved'}
          {saveStatus === 'saving' && '○ Saving…'}
          {saveStatus === 'unsaved' && '● Unsaved'}
        </span>
        {charCount ? (
          <span>{charCount.words()} words</span>
        ) : wordCount > 0 ? (
          <span>{wordCount.toLocaleString()} words</span>
        ) : null}
      </span>

      {/* Focus mode toggle */}
      <button
        onClick={toggleFocusMode}
        title={focusMode ? 'Exit focus mode' : 'Focus mode'}
        className={cn(
          'text-xs px-2 py-1 rounded transition-colors ml-1',
          focusMode
            ? 'text-brand bg-brand/20'
            : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
        )}
      >
        {focusMode ? '⊠' : '⊡'}
      </button>
    </div>
  )
}
