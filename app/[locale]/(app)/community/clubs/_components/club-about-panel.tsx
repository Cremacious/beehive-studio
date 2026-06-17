import { BookOpen } from 'lucide-react'
import type { ClubSummary, ClubCurrentBook } from '@/lib/actions/book-clubs.actions'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'

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
 * C5d-port C4: 2-col grid — description+rules+tags left, currentBook+info right.
 * Stacks on mobile via Tailwind `lg:` prefix.
 */
export function ClubAboutPanel({ club, currentBook, locale }: Props) {
  void locale
  const tags = club.tags ?? []

  return (
    <section className="panel panel-pad">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left col: description + rules + tags */}
        <div>
          <h2 className="font-display font-bold text-[var(--brand)] text-lg mb-2">
            About
          </h2>
          {club.description ? (
            <p className="text-sm text-[var(--canvas-dark-ink)] whitespace-pre-wrap max-w-prose">
              <RenderMentionsInText text={club.description} />
            </p>
          ) : (
            <p className="text-sm text-[var(--canvas-dark-ink-muted)] italic">
              No description.
            </p>
          )}

          {club.rules && (
            <>
              <h3 className="eyebrow-mono mt-6 mb-2">House rules</h3>
              <p className="text-sm text-[var(--canvas-dark-ink)] whitespace-pre-wrap max-w-prose">
                <RenderMentionsInText text={club.rules} />
              </p>
            </>
          )}

          {tags.length > 0 && (
            <>
              <h3 className="eyebrow-mono mt-6 mb-2">Tags</h3>
              <ul className="tag-row">
                {tags.map((tag) => (
                  <li
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Right col: currentBook card + info card */}
        <div className="space-y-4">
          {currentBook && (
            <div className="tile tile-pad">
              <div className="eyebrow-mono mb-2">Currently reading</div>
              <div className="flex items-start gap-3">
                {currentBook.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentBook.coverUrl}
                    alt=""
                    className="h-20 w-14 object-cover rounded-sm shrink-0"
                    style={{ aspectRatio: '2 / 3' }}
                  />
                ) : (
                  <div
                    className="h-20 w-14 rounded-sm shrink-0 flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--canvas-dark-200), var(--canvas-dark-100))',
                    }}
                  >
                    <BookOpen
                      className="h-5 w-5 text-[var(--canvas-dark-ink-muted)]"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className="font-display font-bold text-sm text-[var(--canvas-dark-ink-strong)] truncate"
                  >
                    {currentBook.title}
                  </p>
                  <p className="text-xs text-[var(--canvas-dark-ink-muted)] truncate">
                    by {currentBook.author}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="tile tile-pad">
            <div className="eyebrow-mono mb-2">Info</div>
            <div className="text-xs text-[var(--canvas-dark-ink-muted)] space-y-1">
              <div>
                {club.memberCount}{' '}
                {club.memberCount === 1 ? 'member' : 'members'}
              </div>
              <div>Founded {formatDate(club.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
