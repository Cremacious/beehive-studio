import Link from 'next/link'
import type { DiscoverBook } from '@/lib/actions/discover.actions'

type Props = { book: DiscoverBook; locale: string }

export function BookCard({ book, locale }: Props) {
  const wordCountFormatted =
    book.wordCount >= 1000
      ? `${Math.round(book.wordCount / 1000)}k words`
      : `${book.wordCount} words`

  return (
    <Link href={`/${locale}/books/${book.id}`} className="block group">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden hover:border-[#3a3a3a] transition-colors">
        <div className="aspect-[2/3] bg-gradient-to-br from-[#1e1e1e] to-[#2a2a2a] relative flex items-end p-2">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          {book.genre && (
            <span className="relative z-10 text-[10px] text-[#aaa] bg-black/60 px-1.5 py-0.5 rounded">
              {book.genre}
            </span>
          )}
        </div>

        <div className="p-2.5">
          <p className="text-white text-[13px] font-semibold leading-snug line-clamp-2 mb-0.5">{book.title}</p>
          <p className="text-[#666] text-[11px] mb-2">
            by {book.authorDisplayName ?? book.authorUsername ?? 'Unknown'}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#555]">{wordCountFormatted}</span>
            <div className="flex gap-2 text-[11px] text-[#555]">
              <span>♥ {book.likeCount}</span>
              <span>🔖 {book.bookmarkCount}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
