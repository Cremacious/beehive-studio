'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Editor } from '@tiptap/react'
// Side-effect import: pulls in module augmentations for all StarterKit commands
import '@tiptap/starter-kit'
import { useBookEditor } from '../book-editor-provider'
import type { CharacterCountStorage } from '@tiptap/extensions'
import { ExportModal } from '../export-modal'

type Props = {
  editor: Editor
  onToggleAnalysis: () => void
  analysisOpen: boolean
  onToggleSounds: () => void
  soundsOpen: boolean
  onToggleFind: () => void
  findOpen: boolean
}

type ToolbarButtonProps = {
  onClick: () => void
  disabled?: boolean
  isActive?: boolean
  title?: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, disabled, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
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

export function EditorToolbar({ editor, onToggleAnalysis, analysisOpen, onToggleSounds, soundsOpen, onToggleFind, findOpen }: Props) {
  const { saveStatus, wordCount, focusMode, toggleFocusMode, typewriterMode, toggleTypewriterMode } = useBookEditor()

  const [showExport, setShowExport] = useState(false)

  const [fontSize, setFontSizeState] = useState(() => {
    if (typeof window === 'undefined') return 16
    return parseInt(localStorage.getItem('editor-font-size') ?? '16', 10)
  })

  function setFontSize(size: number) {
    setFontSizeState(size)
    localStorage.setItem('editor-font-size', String(size))
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`)
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`)
  }, [fontSize])

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
        &quot;
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

      {/* Find & Replace */}
      <ToolbarButton onClick={onToggleFind} isActive={findOpen} title="Find & replace (⌘F)">
        🔍
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

      {/* Export */}
      <button
        onClick={() => setShowExport(true)}
        title="Export book"
        className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors"
      >
        ↓ Export
      </button>

      {/* Font size control */}
      <select
        value={fontSize}
        onChange={e => setFontSize(Number(e.target.value))}
        className="text-xs bg-surface border border-border rounded px-1 py-0.5 text-foreground/60 ml-1"
      >
        {[12, 14, 16, 18, 20, 24].map(s => (
          <option key={s} value={s}>{s}px</option>
        ))}
      </select>

      {/* Typewriter mode toggle */}
      <button
        onClick={toggleTypewriterMode}
        title={typewriterMode ? 'Exit typewriter mode' : 'Typewriter mode'}
        className={cn(
          'text-xs px-2 py-1 rounded transition-colors ml-1',
          typewriterMode
            ? 'text-brand bg-brand/20'
            : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
        )}
      >
        ✍
      </button>

      {/* Writing analysis toggle */}
      <button
        onClick={onToggleAnalysis}
        title="Writing analysis"
        className={cn(
          'text-xs px-2 py-1 rounded transition-colors ml-1',
          analysisOpen
            ? 'text-brand bg-brand/20'
            : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
        )}
      >
        📊
      </button>

      {/* Ambient sounds toggle */}
      <button
        onClick={onToggleSounds}
        title="Ambient sounds"
        className={cn(
          'text-xs px-2 py-1 rounded transition-colors ml-1',
          soundsOpen
            ? 'text-brand bg-brand/20'
            : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
        )}
      >
        🎵
      </button>

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

      <ExportModal open={showExport} onClose={() => setShowExport(false)} />
    </div>
  )
}
