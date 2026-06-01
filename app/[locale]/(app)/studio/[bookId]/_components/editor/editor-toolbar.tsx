'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  HelpCircle,
  Eye,
  MessagesSquare,
  Heading as HeadingIcon,
  Type as TypeIcon,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

type Props = {
  editor: Editor
  // Find & Replace + Writing Analysis are chapter-specific surfaces (they
  // operate on chapter prose, snapshots, etc.). When the toolbar is mounted
  // for a non-chapter editor (e.g. notes), the consumer omits these props
  // and the corresponding buttons render nothing.
  onToggleAnalysis?: () => void
  analysisOpen?: boolean
  onToggleFind?: () => void
  findOpen?: boolean
}

type ToolbarButtonProps = {
  onClick: () => void
  disabled?: boolean
  isActive?: boolean
  title?: string
  children: React.ReactNode
}

// Shared className builder so ad-hoc buttons (Sun/Moon, font-select, Export,
// Analysis, Focus) get the same hover/active/disabled treatment as the
// ToolbarButton wrapper. Mockup spec: 30x30 icon button, r-md (10px), chrome-400
// default, chrome-100 + chrome-800 on hover. Active state moves to solid
// brand-yellow per the 5-sanctioned-uses rule (vs the mockup's brand-soft tint).
function tbtnClass({
  isActive = false,
  disabled = false,
  hasLabel = false,
}: { isActive?: boolean; disabled?: boolean; hasLabel?: boolean } = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-[10px] transition-colors',
    hasLabel ? 'h-[30px] gap-1.5 px-2.5 text-xs font-medium' : 'h-[30px] w-[30px]',
    'text-foreground/65 hover:text-foreground hover:bg-surface-elevated',
    isActive && 'bg-brand text-brand-ink hover:bg-brand-hover hover:text-brand-ink',
    disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-foreground/65',
  )
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
      aria-label={title}
      className={tbtnClass({ isActive, disabled })}
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
  return <span className="w-px h-[18px] bg-border mx-1.5" />
}

export function EditorToolbar({ editor, onToggleAnalysis, analysisOpen, onToggleFind, findOpen }: Props) {
  const { focusMode, toggleFocusMode, editorTheme, toggleEditorTheme, historyOpen, toggleHistory, bookId, locale, bookHive, gutterOpen, toggleGutter } = useBookEditor()
  const router = useRouter()

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
        className="flex items-center gap-1 h-12 px-3.5 border-b border-border bg-surface"
      >
        {/* FORMAT zone (left) */}
        <div className="flex items-center gap-0.5">
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

          {/* Heading dropdown — groups H1/H2/H3 into a single trigger so the
              toolbar stays single-row. Active state lights when any heading
              level is active. */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    aria-label="Heading"
                    className={tbtnClass({ isActive: editor.isActive('heading') })}
                  >
                    <HeadingIcon size={14} />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Heading</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" onCloseAutoFocus={e => e.preventDefault()}>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={cn(editor.isActive('heading', { level: 1 }) && 'bg-brand/15 text-foreground')}
              >
                <Heading1 size={14} className="mr-2" /> Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={cn(editor.isActive('heading', { level: 2 }) && 'bg-brand/15 text-foreground')}
              >
                <Heading2 size={14} className="mr-2" /> Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={cn(editor.isActive('heading', { level: 3 }) && 'bg-brand/15 text-foreground')}
              >
                <Heading3 size={14} className="mr-2" /> Heading 3
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().setParagraph().run()}
                className={cn(editor.isActive('paragraph') && !editor.isActive('heading') && 'bg-brand/15 text-foreground')}
              >
                <TypeIcon size={14} className="mr-2" /> Paragraph
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator />

          {/* List dropdown — groups bullet + ordered into a single trigger. */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    aria-label="List"
                    className={tbtnClass({ isActive: editor.isActive('bulletList') || editor.isActive('orderedList') })}
                  >
                    <List size={14} />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>List</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" onCloseAutoFocus={e => e.preventDefault()}>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleBulletList().run()}
                className={cn(editor.isActive('bulletList') && 'bg-brand/15 text-foreground')}
              >
                <List size={14} className="mr-2" /> Bullet list
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn(editor.isActive('orderedList') && 'bg-brand/15 text-foreground')}
              >
                <ListOrdered size={14} className="mr-2" /> Numbered list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

          {/* Align dropdown — groups L/C/R into one trigger. Icon reflects
              current alignment when set; defaults to AlignLeft. */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    aria-label="Align"
                    className={tbtnClass({
                      isActive:
                        editor.isActive({ textAlign: 'center' }) ||
                        editor.isActive({ textAlign: 'right' }),
                    })}
                  >
                    {editor.isActive({ textAlign: 'center' })
                      ? <AlignCenter size={14} />
                      : editor.isActive({ textAlign: 'right' })
                        ? <AlignRight size={14} />
                        : <AlignLeft size={14} />}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Align</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" onCloseAutoFocus={e => e.preventDefault()}>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().setTextAlign('left').run()}
                className={cn(editor.isActive({ textAlign: 'left' }) && 'bg-brand/15 text-foreground')}
              >
                <AlignLeft size={14} className="mr-2" /> Align left
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().setTextAlign('center').run()}
                className={cn(editor.isActive({ textAlign: 'center' }) && 'bg-brand/15 text-foreground')}
              >
                <AlignCenter size={14} className="mr-2" /> Align center
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().setTextAlign('right').run()}
                className={cn(editor.isActive({ textAlign: 'right' }) && 'bg-brand/15 text-foreground')}
              >
                <AlignRight size={14} className="mr-2" /> Align right
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Single spacer pushes everything after it to the right.
            Status + view zones sit together so Export doesn't get pushed
            off-screen by symmetric flex-1 padding. */}
        <span className="flex-1" />

        {/* VIEW zone (right) */}
        <div className="flex items-center gap-0.5">
          {/* Preview as reader */}
          <ToolbarButton
            onClick={() => router.push(`/${locale}/books/${bookId}`)}
            title="Preview as reader"
          >
            <Eye size={14} />
          </ToolbarButton>

          {/* Find & Replace — chapter-only */}
          {onToggleFind && (
            <ToolbarButton onClick={onToggleFind} isActive={findOpen} title="Find & replace (⌘F)">
              <Search size={14} />
            </ToolbarButton>
          )}

          {/* Version history */}
          <ToolbarButton onClick={toggleHistory} isActive={historyOpen} title="Version history">
            <History size={14} />
          </ToolbarButton>

          {/* Collaboration gutter — only when this book has a hive */}
          {bookHive && (
            <ToolbarButton
              onClick={toggleGutter}
              isActive={gutterOpen}
              title="Toggle collaboration gutter"
            >
              <MessagesSquare size={14} />
            </ToolbarButton>
          )}

          {/* Editor theme toggle (Sun/Moon) — shows the icon for the destination mode */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleEditorTheme}
                aria-label={editorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className={tbtnClass()}
              >
                {editorTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {editorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </TooltipContent>
          </Tooltip>

          {/* More menu — utilities (Help, Font size, Export, Writing analysis).
              Keeps the toolbar single-row so Focus mode stays visible at
              narrow viewports. */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    aria-label="More"
                    className={tbtnClass({ isActive: analysisOpen })}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" onCloseAutoFocus={e => e.preventDefault()}>
              <DropdownMenuItem
                onSelect={() => window.dispatchEvent(new Event('beehive:toggle-cheatsheet'))}
              >
                <HelpCircle size={14} className="mr-2" /> Keyboard shortcuts
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowExport(true)}>
                <Download size={14} className="mr-2" /> Export book
              </DropdownMenuItem>
              {onToggleAnalysis && (
                <DropdownMenuItem
                  onSelect={onToggleAnalysis}
                  className={cn(analysisOpen && 'bg-brand/15 text-foreground')}
                >
                  <BarChart3 size={14} className="mr-2" /> Writing analysis
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground/70">
                <TypeIcon size={14} />
                <span>Font size</span>
                <select
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  aria-label="Font size"
                  className="ml-auto h-[26px] rounded-[8px] bg-surface-elevated border border-border px-2 text-xs text-foreground/80 hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/40"
                >
                  {[12, 14, 16, 18, 20, 24].map(s => (
                    <option key={s} value={s}>{s}px</option>
                  ))}
                </select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Focus mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={toggleFocusMode}
                aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
                className={tbtnClass({ isActive: focusMode })}
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
