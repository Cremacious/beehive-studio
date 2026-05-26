'use client'

import type { Editor } from '@tiptap/react'
import '@tiptap/starter-kit'
import { cn } from '@/lib/utils'
import { Bold, Italic, List, ListOrdered, Quote } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Props = { editor: Editor }

// Local copy of the tbtnClass pattern from editor/editor-toolbar.tsx (DP2).
// Kept duplicated rather than imported per DP3 Task 1 Step 3 — the chapter
// toolbar's helper is not exported and ad-hoc duplication is fine for now.
function tbtnClass({
  isActive = false,
  disabled = false,
}: { isActive?: boolean; disabled?: boolean } = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-[10px] transition-colors',
    'h-[28px] w-[28px]',
    'text-foreground/65 hover:text-foreground hover:bg-surface-elevated',
    isActive && 'bg-brand text-brand-ink hover:bg-brand-hover hover:text-brand-ink',
    disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-foreground/65',
  )
}

function Btn({ onClick, isActive, title, children }: {
  onClick: () => void
  isActive: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={onClick}
          aria-label={title}
          className={tbtnClass({ isActive })}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  )
}

export function NoteToolbar({ editor }: Props) {
  return (
    <TooltipProvider>
      <div
        data-slot="note-toolbar"
        className="inline-flex items-center gap-0.5 p-1 mx-6 mt-3 bg-surface border border-border rounded-[10px] shadow-sm self-start"
      >
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Cmd+B)"
        >
          <Bold size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Cmd+I)"
        >
          <Italic size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote size={14} />
        </Btn>
      </div>
    </TooltipProvider>
  )
}
