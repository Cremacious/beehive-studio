import type { ClubSummary, ClubCurrentBook } from '@/lib/actions/book-clubs.actions'

type Props = {
  club: ClubSummary
  currentBook: ClubCurrentBook | null
  locale: string
}

/**
 * T11 stub. T13 will enrich with: full description rendering, rules section,
 * tag chips, current-book card with cover + status, founded/updated dates.
 */
export function ClubAboutPanel({ club, currentBook, locale }: Props) {
  void locale
  return (
    <div className="space-y-4">
      {club.rules && (
        <section>
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-2">
            Rules
          </h2>
          <p className="text-sm text-[var(--canvas-dark-ink)] whitespace-pre-wrap">
            {club.rules}
          </p>
        </section>
      )}
      {currentBook && (
        <section>
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-2">
            Currently reading
          </h2>
          <p className="text-sm text-[var(--canvas-dark-ink)]">
            <strong>{currentBook.title}</strong> by {currentBook.author}
          </p>
        </section>
      )}
      {!club.rules && !currentBook && (
        <p className="text-[var(--canvas-dark-ink-muted)] italic">Nothing here yet.</p>
      )}
    </div>
  )
}
