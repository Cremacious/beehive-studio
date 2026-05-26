'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Editor } from '@tiptap/react'
// Side-effect import: pulls in module augmentations for all StarterKit commands
import '@tiptap/starter-kit'
import { useBookEditor } from '../book-editor-provider'
import type { CharacterCountStorage } from '@tiptap/extensions'
import { ExportModal } from '../export-modal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'

type Props = {
  editor: Editor
  onToggleAnalysis: () => void
  analysisOpen: boolean
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
  const button = (
    <button
      // Prevent the button from stealing focus from the editor on click.
      // Without this, the editor's selection collapses to the previous cursor
      // position when the button is pressed — node-level commands (heading,
      // list, blockquote, link) silently fail because they no longer have a
      // valid selection range to act on. Standard TipTap toolbar pattern.
      onMouseDown={e => e.preventDefault()}
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
  if (!title) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  )
}

function Separator() {
  return <span className="w-px h-4 bg-border mx-1" />
}

export function EditorToolbar({ editor, onToggleAnalysis, analysisOpen, onToggleFind, findOpen }: Props) {
  const { saveStatus, wordCount, focusMode, toggleFocusMode } = useBookEditor()

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
    <TooltipProvider>
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-surface">
        {/* Inline */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (⌘B)"
        >
          B
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (⌘I)"
        >
          I
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          S
        </ToolbarButton>

        <Separator />

        {/* Block — disabled checks removed: editor.can().chain()...run() was
            returning false in TipTap v3, blocking clicks entirely. The chain
            no-ops gracefully when it can't apply, so we don't need the gate. */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <Separator />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet list"
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered list"
        >
          1.
        </ToolbarButton>

        {/* Other */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          &quot;
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          —
        </ToolbarButton>

        <Separator />

        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (⌘Z)"
        >
          ↺
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (⌘⇧Z)"
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
          title="Underline (⌘U)"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive('highlight')}
          title="Highlight"
        >
          H
        </ToolbarButton>
        <ToolbarButton
          onClick={handleLinkClick}
          isActive={editor.isActive('link')}
          title="Link"
        >
          🔗
        </ToolbarButton>

        <Separator />

        {/* Align — distinct lucide icons so users can tell L/C/R apart */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align left"
        >
          <AlignLeft size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align center"
        >
          <AlignCenter size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align right"
        >
          <AlignRight size={14} />
        </ToolbarButton>

        <span className="flex-1" />

        {/* Save status + word count — fixed-width to prevent toolbar shift
            when status text or word count changes width */}
        <span className="flex items-center gap-3 text-xs text-foreground/40 min-w-[180px] justify-end tabular-nums">
          <span
            className={cn(
              'inline-flex items-center gap-1 w-[72px] justify-end',
              saveStatus === 'unsaved' && 'text-brand',
              saveStatus === 'saving' && 'text-foreground/40 animate-pulse',
            )}
          >
            {saveStatus === 'saved' && '● Saved'}
            {saveStatus === 'saving' && '○ Saving…'}
            {saveStatus === 'unsaved' && '● Unsaved'}
          </span>
          <span className="inline-block w-[80px] text-right">
            {charCount ? `${charCount.words()} words` : wordCount > 0 ? `${wordCount.toLocaleString()} words` : ''}
          </span>
        </span>

        {/* Export */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors"
            >
              ↓ Export
            </button>
          </TooltipTrigger>
          <TooltipContent>Export book</TooltipContent>
        </Tooltip>

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

        {/* Writing analysis toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={onToggleAnalysis}
              className={cn(
                'text-xs px-2 py-1 rounded transition-colors ml-1',
                analysisOpen
                  ? 'text-brand bg-brand/20'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              📊
            </button>
          </TooltipTrigger>
          <TooltipContent>Writing analysis — readability, pacing, word stats</TooltipContent>
        </Tooltip>

        {/* Focus mode toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={toggleFocusMode}
              className={cn(
                'text-xs px-2 py-1 rounded transition-colors ml-1',
                focusMode
                  ? 'text-brand bg-brand/20'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              {focusMode ? '⊠' : '⊡'}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {focusMode ? 'Exit focus mode' : 'Focus mode — hide sidebars'}
          </TooltipContent>
        </Tooltip>

        <ExportModal open={showExport} onClose={() => setShowExport(false)} />
      </div>
    </TooltipProvider>
  )
}
