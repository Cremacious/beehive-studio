'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
  Save,
  ChevronDown,
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
// ToolbarButton wrapper. T4 (aesthetic refresh): 30x30 tiles use --r-btn
// (12px) + inset tile gradient (via tbtnStyle) + --sh-tile. Active state is
// solid brand-yellow with brand-ink icon per spec rule 4.
function tbtnClass({
  isActive = false,
  disabled = false,
  hasLabel = false,
}: { isActive?: boolean; disabled?: boolean; hasLabel?: boolean } = {}) {
  return cn(
    'inline-flex items-center justify-center transition-colors',
    hasLabel ? 'h-[30px] gap-1.5 px-2.5 text-xs font-medium' : 'h-[30px] w-[30px]',
    !isActive && 'text-[var(--brand)]',
    disabled && 'cursor-not-allowed opacity-70',
  )
}

// Inline-style helper for the iOS-depth tile treatment. Idle tiles get the
// inset gradient + --sh-tile; active tiles get solid brand-yellow. Hover is
// wired via onMouseEnter/onMouseLeave that swap the gradient stops (kept
// inline so we don't bleed CSS into globals.css for a single surface).
function tbtnStyle(isActive: boolean): React.CSSProperties {
  return {
    borderRadius: 'var(--r-btn)',
    background: isActive
      ? 'var(--brand)'
      : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
    color: isActive ? '#1a1a1a' : undefined,
  }
}

function tbtnHoverEnter(e: React.MouseEvent<HTMLButtonElement>, isActive: boolean) {
  if (isActive) return
  e.currentTarget.style.background =
    'linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))'
}

function tbtnHoverLeave(e: React.MouseEvent<HTMLButtonElement>, isActive: boolean) {
  if (isActive) return
  e.currentTarget.style.background =
    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
}

// Shared panel treatment for dropdown menus (Heading▾, List▾, Align▾, More▾).
// Mirrors T3's panel: gradient bg + --r-card + --sh-card + --br-card.
const dropdownPanelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  border: 'var(--br-card)',
}

function ToolbarButton({ onClick, disabled, isActive, title, children }: ToolbarButtonProps) {
  const active = !!isActive
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
      style={tbtnStyle(active)}
      onMouseEnter={e => tbtnHoverEnter(e, active)}
      onMouseLeave={e => tbtnHoverLeave(e, active)}
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

export function EditorToolbar({ editor, onToggleAnalysis, analysisOpen, onToggleFind, findOpen }: Props) {
  const { focusMode, toggleFocusMode, editorTheme, toggleEditorTheme, historyOpen, toggleHistory, bookId, locale, bookHive, gutterOpen, toggleGutter, flushPendingSave, saveStatus, activeItem, activeChapter, liveCollabCounts } = useBookEditor()

  async function handleManualSave() {
    const label = activeItem?.title ?? 'chapter'
    await flushPendingSave()
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    toast.success(`Saved ${label}`, { description: stamp })
  }
  const router = useRouter()

  const [showExport, setShowExport] = useState(false)

  // Read the active font size from the current selection. Returns null when
  // the selection has no fontSize mark (default body size) and the string
  // size (e.g. "18px") when the fontSize mark sets one. The dropdown label
  // reflects this so the user can see what the cursor is sitting on.
  const activeFontSize: string | null = (() => {
    const attrs = editor.getAttributes('fontSize') as { size?: string | null }
    return attrs?.size ?? null
  })()
  const activeFontSizeNum = activeFontSize ? parseInt(activeFontSize, 10) : null

  function applyFontSize(size: number) {
    editor.chain().focus().setFontSize(`${size}px`).run()
  }

  function clearFontSize() {
    editor.chain().focus().unsetFontSize().run()
  }

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
        className="flex items-center gap-1 px-3 py-2"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderTopLeftRadius: 'var(--r-card)',
          borderTopRightRadius: 'var(--r-card)',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
      >
        {/* FORMAT zone (left) */}
        <div className="flex items-center gap-0.5">
          {/* Manual save */}
          <ToolbarButton
            onClick={() => { void handleManualSave() }}
            title="Save (⌘S)"
          >
            <Save size={14} />
          </ToolbarButton>

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
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline (⌘U)"
          >
            <Underline size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough size={14} />
          </ToolbarButton>

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
                    style={tbtnStyle(editor.isActive('heading'))}
                    onMouseEnter={e => tbtnHoverEnter(e, editor.isActive('heading'))}
                    onMouseLeave={e => tbtnHoverLeave(e, editor.isActive('heading'))}
                  >
                    <HeadingIcon size={14} />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Heading</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" onCloseAutoFocus={e => e.preventDefault()} style={dropdownPanelStyle}>
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

          {/* List dropdown — groups bullet + ordered into a single trigger. */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    aria-label="List"
                    className={tbtnClass({ isActive: editor.isActive('bulletList') || editor.isActive('orderedList') })}
                    style={tbtnStyle(editor.isActive('bulletList') || editor.isActive('orderedList'))}
                    onMouseEnter={e => tbtnHoverEnter(e, editor.isActive('bulletList') || editor.isActive('orderedList'))}
                    onMouseLeave={e => tbtnHoverLeave(e, editor.isActive('bulletList') || editor.isActive('orderedList'))}
                  >
                    <List size={14} />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>List</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" onCloseAutoFocus={e => e.preventDefault()} style={dropdownPanelStyle}>
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

          {/* Format: Highlight, Link */}
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

          {/* Align dropdown — groups L/C/R into one trigger. Icon reflects
              current alignment when set; defaults to AlignLeft. */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  {(() => {
                    const alignActive =
                      editor.isActive({ textAlign: 'center' }) ||
                      editor.isActive({ textAlign: 'right' })
                    return (
                      <button
                        onMouseDown={e => e.preventDefault()}
                        aria-label="Align"
                        className={tbtnClass({ isActive: alignActive })}
                        style={tbtnStyle(alignActive)}
                        onMouseEnter={e => tbtnHoverEnter(e, alignActive)}
                        onMouseLeave={e => tbtnHoverLeave(e, alignActive)}
                      >
                        {editor.isActive({ textAlign: 'center' })
                          ? <AlignCenter size={14} />
                          : editor.isActive({ textAlign: 'right' })
                            ? <AlignRight size={14} />
                            : <AlignLeft size={14} />}
                      </button>
                    )
                  })()}
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Align</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" onCloseAutoFocus={e => e.preventDefault()} style={dropdownPanelStyle}>
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

          {/* Find & Replace — chapter-only */}
          {onToggleFind && (
            <ToolbarButton onClick={onToggleFind} isActive={findOpen} title="Find & replace (⌘F)">
              <Search size={14} />
            </ToolbarButton>
          )}

          {/* Font size — Word-style picker (label + current px + chevron) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    aria-label="Font size"
                    className={cn(
                      'inline-flex items-center gap-1.5 h-[30px] px-2.5 transition-colors',
                      'text-[var(--brand)] text-[12px] font-mono tabular-nums',
                    )}
                    style={{
                      ...tbtnStyle(false),
                      minWidth: 108,
                    }}
                    onMouseEnter={e => tbtnHoverEnter(e, false)}
                    onMouseLeave={e => tbtnHoverLeave(e, false)}
                  >
                    <span>Size {activeFontSizeNum ?? '—'}</span>
                    <ChevronDown size={12} />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Font size (applies to selection)</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" onCloseAutoFocus={e => e.preventDefault()} style={dropdownPanelStyle}>
              <DropdownMenuItem
                onSelect={clearFontSize}
                className={cn(activeFontSizeNum === null && 'bg-brand/15 text-foreground')}
              >
                Default
              </DropdownMenuItem>
              {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(s => (
                <DropdownMenuItem
                  key={s}
                  onSelect={() => applyFontSize(s)}
                  className={cn(activeFontSizeNum === s && 'bg-brand/15 text-foreground')}
                >
                  {s}px
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Single spacer pushes everything after it to the right.
            Status + view zones sit together so Export doesn't get pushed
            off-screen by symmetric flex-1 padding. */}
        <span className="flex-1" />

        {/* VIEW zone (right) */}
        <div className="flex items-center gap-0.5">
          {/* Keyboard shortcuts */}
          <ToolbarButton
            onClick={() => window.dispatchEvent(new Event('beehive:toggle-cheatsheet'))}
            title="Keyboard shortcuts"
          >
            <HelpCircle size={14} />
          </ToolbarButton>

          {/* Preview as reader */}
          <ToolbarButton
            onClick={() => router.push(`/${locale}/books/${bookId}`)}
            title="Preview as reader"
          >
            <Eye size={14} />
          </ToolbarButton>

          {/* Version history */}
          <ToolbarButton onClick={toggleHistory} isActive={historyOpen} title="Version history">
            <History size={14} />
          </ToolbarButton>

          {/* Collaboration gutter — only when this book has a hive.
              Rendered inline (not via ToolbarButton) so we can stack a
              brand-yellow pending-count badge over the top-right corner
              when the gutter is closed and the active chapter has open
              annotations or pending suggestions. */}
          {bookHive && (() => {
            // Prefer the gutter's live unresolved counts (updates after
            // resolve/reject); fall back to the chapter's server-fetched
            // counts during the window between chapter switch and the
            // gutter's first useCollabData resolve.
            const fallbackCount = activeChapter
              ? activeChapter.annotationCount + activeChapter.pendingSuggestionCount
              : 0
            const liveCount = liveCollabCounts
              ? liveCollabCounts.annotations + liveCollabCounts.suggestions
              : fallbackCount
            const gutterPendingCount = !gutterOpen ? liveCount : 0
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    onClick={toggleGutter}
                    aria-label="Toggle collaboration gutter"
                    className={tbtnClass({ isActive: gutterOpen })}
                    style={{ ...tbtnStyle(gutterOpen), position: 'relative' }}
                    onMouseEnter={e => tbtnHoverEnter(e, gutterOpen)}
                    onMouseLeave={e => tbtnHoverLeave(e, gutterOpen)}
                  >
                    <MessagesSquare size={14} />
                    {gutterPendingCount > 0 && (
                      <span
                        aria-label={`${gutterPendingCount} pending collaboration items`}
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          minWidth: 16,
                          height: 16,
                          padding: '0 4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 999,
                          background: 'var(--brand)',
                          color: 'var(--brand-ink, #1a1a1a)',
                          fontSize: 9,
                          fontWeight: 700,
                          lineHeight: 1,
                          pointerEvents: 'none',
                        }}
                      >
                        {gutterPendingCount > 99 ? '99+' : gutterPendingCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Toggle collaboration gutter</TooltipContent>
              </Tooltip>
            )
          })()}

          {/* Editor theme toggle (Sun/Moon) — shows the icon for the destination mode */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleEditorTheme}
                aria-label={editorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className={tbtnClass()}
                style={tbtnStyle(false)}
                onMouseEnter={e => tbtnHoverEnter(e, false)}
                onMouseLeave={e => tbtnHoverLeave(e, false)}
              >
                {editorTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {editorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </TooltipContent>
          </Tooltip>

          {/* Export book */}
          <ToolbarButton onClick={() => setShowExport(true)} title="Export book">
            <Download size={14} />
          </ToolbarButton>

          {/* Writing analysis */}
          {onToggleAnalysis && (
            <ToolbarButton
              onClick={onToggleAnalysis}
              isActive={analysisOpen}
              title="Writing analysis"
            >
              <BarChart3 size={14} />
            </ToolbarButton>
          )}


          {/* Focus mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={toggleFocusMode}
                aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
                className={tbtnClass({ isActive: focusMode })}
                style={tbtnStyle(focusMode)}
                onMouseEnter={e => tbtnHoverEnter(e, focusMode)}
                onMouseLeave={e => tbtnHoverLeave(e, focusMode)}
              >
                {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {focusMode ? 'Exit focus mode' : 'Focus mode (hide sidebars)'}
            </TooltipContent>
          </Tooltip>
        </div>

        <ExportModal open={showExport} onClose={() => setShowExport(false)} />
      </div>
    </TooltipProvider>
  )
}
