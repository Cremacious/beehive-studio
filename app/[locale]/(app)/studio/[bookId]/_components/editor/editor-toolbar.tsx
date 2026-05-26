'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Editor } from '@tiptap/react'
// Side-effect import: pulls in module augmentations for all StarterKit commands
import '@tiptap/starter-kit'
import { useBookEditor } from '../book-editor-provider'
import { ExportModal } from '../export-modal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus,
  Undo, Redo, Search,
  Underline, Highlighter, Link,
  BarChart3,
  Maximize2, Minimize2,
  Download,
  Sun, Moon,
  History,
} from 'lucide-react'

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
  const { focusMode, toggleFocusMode, editorTheme, toggleEditorTheme, historyOpen, toggleHistory } = useBookEditor()

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

  return (
    <TooltipProvider>
      <div
        data-slot="editor-toolbar"
        className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-surface"
      >
        {/* FORMAT zone (left) */}
        <div className="flex items-center gap-1">
          {/* Inline */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold (⌘B)"
          >
            <Bold size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic (⌘I)"
          >
            <Italic size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough size={14} />
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
            <Heading1 size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <Heading3 size={14} />
          </ToolbarButton>

          <Separator />

          {/* Lists, quote, hr */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet list"
          >
            <List size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered list"
          >
            <ListOrdered size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Quote"
          >
            <Quote size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
          >
            <Minus size={14} />
          </ToolbarButton>

          <Separator />

          {/* History */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (⌘Z)"
          >
            <Undo size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (⌘⇧Z)"
          >
            <Redo size={14} />
          </ToolbarButton>

          <Separator />

          {/* Format: Underline, Highlight, Link */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline (⌘U)"
          >
            <Underline size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            title="Highlight"
          >
            <Highlighter size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={handleLinkClick}
            isActive={editor.isActive('link')}
            title="Link"
          >
            <Link size={14} />
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
        </div>

        {/* Single spacer pushes everything after it to the right.
            Status + view zones sit together so Export doesn't get pushed
            off-screen by symmetric flex-1 padding. */}
        <span className="flex-1" />

        {/* VIEW zone (right) */}
        <div className="flex items-center gap-1">
          {/* Find & Replace */}
          <ToolbarButton onClick={onToggleFind} isActive={findOpen} title="Find & replace (⌘F)">
            <Search size={14} />
          </ToolbarButton>

          {/* Version history */}
          <ToolbarButton onClick={toggleHistory} isActive={historyOpen} title="Version history">
            <History size={14} />
          </ToolbarButton>

          {/* Editor theme toggle (Sun/Moon) — shows the icon for the destination mode */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleEditorTheme}
                className="text-xs px-2 py-1 rounded transition-colors text-foreground/60 hover:text-foreground hover:bg-surface-elevated"
              >
                {editorTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {editorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </TooltipContent>
          </Tooltip>

          {/* Font size control */}
          <select
            value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            className="text-xs bg-surface border border-border rounded px-1 py-0.5 text-foreground/60"
          >
            {[12, 14, 16, 18, 20, 24].map(s => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>

          {/* Export */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowExport(true)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground/60 hover:text-foreground hover:bg-surface-elevated transition-colors"
              >
                <Download size={14} />
                <span>Export</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Export book</TooltipContent>
          </Tooltip>

          {/* Writing analysis toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={onToggleAnalysis}
                className={cn(
                  'text-xs px-2 py-1 rounded transition-colors',
                  analysisOpen
                    ? 'text-brand bg-brand/20'
                    : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
                )}
              >
                <BarChart3 size={14} />
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
                  'text-xs px-2 py-1 rounded transition-colors',
                  focusMode
                    ? 'text-brand bg-brand/20'
                    : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
                )}
              >
                {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {focusMode ? 'Exit focus mode' : 'Focus mode — hide sidebars'}
            </TooltipContent>
          </Tooltip>
        </div>

        <ExportModal open={showExport} onClose={() => setShowExport(false)} />
      </div>
    </TooltipProvider>
  )
}
