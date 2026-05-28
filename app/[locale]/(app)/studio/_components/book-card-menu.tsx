'use client'

import Link from 'next/link'
import { MoreHorizontal, Pencil, BookOpen, Eye, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteBookButton } from '@/components/book/delete-book-button'

type Props = {
  locale: string
  bookId: string
  bookTitle: string
}

export function BookCardMenu({ locale, bookId, bookTitle }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          aria-label="Book menu"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas-dark-100)]"
          style={{
            background: 'oklch(0.15 0.003 256 / 0.55)',
            color: 'var(--canvas-dark-ink)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--canvas-dark-300)',
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-48 border-[var(--canvas-dark-300)] bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink)]"
      >
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/studio/${bookId}`} className="cursor-pointer no-underline">
            <BookOpen size={14} /> Open
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/books/${bookId}`} className="cursor-pointer no-underline">
            <Eye size={14} /> Preview
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/studio/${bookId}/details`} className="cursor-pointer no-underline">
            <Pencil size={14} /> Edit details
          </Link>
        </DropdownMenuItem>
        <DeleteBookButton bookId={bookId} bookTitle={bookTitle} locale={locale}>
          {(onTrigger) => (
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); onTrigger() }}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 size={14} /> Delete book
            </DropdownMenuItem>
          )}
        </DeleteBookButton>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
