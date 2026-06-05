import { BookOpen } from 'lucide-react'
import type { ClubSummary, ClubCurrentBook } from '@/lib/actions/book-clubs.actions'

type Props = {
  club: ClubSummary
  currentBook: ClubCurrentBook | null
  locale: string
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * T13 enriched: description, rules, tag chips (full list), current-book card,
 * founded date.
 */
export function ClubAboutPanel({ club, currentBook, locale }: Props) {
  void locale
  const tags = club.tags ?? []

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-2">
          About
        </h2>
        {club.description ? (
          <p className="text-sm text-[var(--canvas-dark-ink)] whitespace-pre-wrap max-w-prose">
            {club.description}
          </p>
        ) : (
          <p className="text-sm text-[var(--canvas-dark-ink-muted)] italic">
            No description.
          </p>
        )}
      </section>

      {currentBook && (
        <section>
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-2">
            Currently reading
          </h2>
          <div
            className="flex items-start gap-3 p-3 rounded-[var(--r-row)] border border-[var(--br-card)]"
            style={{
              background:
                'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-250))',
            }}
          >
            {currentBook.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentBook.coverUrl}
                alt=""
                className="h-24 w-16 object-cover rounded-sm shrink-0"
                style={{ aspectRatio: '2 / 3' }}
              />
            ) : (
              <div
                className="h-24 w-16 rounded-sm shrink-0 flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, var(--canvas-dark-200), var(--canvas-dark-100))',
                }}
              >
                <BookOpen
                  className="h-6 w-6 text-[var(--canvas-dark-ink-muted)]"
                  aria-hidden="true"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="inline-block mb-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[var(--brand)] text-[var(--brand-ink)]">
                Reading now
              </span>
              <p
                className="font-bold text-[var(--canvas-dark-ink-strong)] truncate"
                style={{ fontFamily: 'var(--font-comfortaa)' }}
              >
                {currentBook.title}
              </p>
              <p className="text-xs text-[var(--canvas-dark-ink-muted)] truncate">
                by {currentBook.author}
              </p>
            </div>
          </div>
        </section>
      )}

      {club.rules && (
        <section>
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-2">
            House rules
          </h2>
          <p className="text-sm text-[var(--canvas-dark-ink)] whitespace-pre-wrap max-w-prose">
            {club.rules}
          </p>
        </section>
      )}

      {tags.length > 0 && (
        <section>
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-2">
            Tags
          </h2>
          <ul className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <li
                key={tag}
                className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]"
              >
                {tag}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
        Founded {formatDate(club.createdAt)}
      </p>
    </div>
  )
}
