'use client'

import Link from 'next/link'
import { BookCardMenu } from './book-card-menu'
import type { BookSummary } from '@/lib/actions/book.actions'
import { optimizeCloudinaryUrl, BOOK_COVER_TRANSFORMS } from '@/lib/upload/cloudinary-url'

type Props = {
  book: BookSummary
  locale: string
  authorName?: string | null
}

/**
 * BookCard — Variant A (portrait, cover on top).
 * Clean rewrite using the `bcv-*` class family in globals.css.
 * Block flow throughout. No flex on body. Single-line ellipsis on title
 * + author so card body height is fully deterministic.
 */
export function BookCard({ book, locale, authorName }: Props) {
  return (
    <div className="bcv">
      <div className="bcv-kebab">
        <BookCardMenu locale={locale} bookId={book.id} bookTitle={book.title} />
      </div>

      <Link href={`/${locale}/studio/${book.id}`} className="bcv-link">
        {/* Cover — uploaded image OR brand-yellow honeycomb default */}
        <div className="bcv-cover">
          {book.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={optimizeCloudinaryUrl(book.coverUrl, BOOK_COVER_TRANSFORMS)} alt={book.title} />
          ) : (
            <svg
              className="honeycomb"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id={`hex-${book.id}`}
                  x="0"
                  y="0"
                  width="60"
                  height="52"
                  patternUnits="userSpaceOnUse"
                >
                  <g
                    fill="none"
                    stroke="rgba(40, 25, 5, 0.22)"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  >
                    <polygon points="15,0 27,7 27,19 15,26 3,19 3,7" />
                    <polygon points="45,26 57,33 57,45 45,52 33,45 33,33" />
                    <polygon points="45,-26 57,-19 57,-7 45,0 33,-7 33,-19" />
                    <polygon points="15,52 27,59 27,71 15,78 3,71 3,59" />
                  </g>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#hex-${book.id})`} />
            </svg>
          )}
        </div>

        {/* Body — title + author + genre (placeholder when null) */}
        <div className="bcv-body">
          <p className="bcv-title">{book.title}</p>
          <p className="bcv-author">{authorName ? `by ${authorName}` : ' '}</p>
          {book.genre ? (
            <span className="bcv-genre">{book.genre}</span>
          ) : (
            <span className="bcv-genre bcv-empty">No genre</span>
          )}
        </div>
      </Link>
    </div>
  )
}
