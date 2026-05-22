'use client'

import type { Editor } from '@tiptap/react'
import '@tiptap/starter-kit'
import { cn } from '@/lib/utils'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Props = { editor: Editor }

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
          className={cn(
            'text-xs px-2 py-1 rounded transition-colors',
            'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
            isActive && 'bg-brand/20 text-brand',
          )}
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
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-surface">
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (⌘B)"
        >
          <Bold size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (⌘I)"
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
      </div>
    </TooltipProvider>
  )
}
