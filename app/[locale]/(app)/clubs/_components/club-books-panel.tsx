import { getClubBooksAction } from '@/lib/actions/book-clubs.actions'
import type {
  ClubBookRow as ClubBookRowType,
  ClubCurrentBook,
} from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'
import { ClubBookRow } from './club-book-row'
import { ClubBooksPanelClient } from './club-books-panel-client'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  currentBook: ClubCurrentBook | null
  locale: string
}

/**
 * T16. Server component fetches the club's full book list and partitions
 * it into CURRENT / QUEUE / PAST. Renders three sections; the QUEUE list +
 * Add-book CTA + dnd-kit reorder live in <ClubBooksPanelClient>.
 *
 * B7 chrome refresh: section headers as `.sec-head > h2`, rows wrapped in
 * `.panel.panel-pad` + `.cstack`, Past reads as a `<details>` accordion.
 */
export async function ClubBooksPanel({
  clubId,
  viewerRole,
  locale,
}: Props) {
  const canManage = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'

  const result = await getClubBooksAction({ clubId })
  if (!result.success) {
    return (
      <div className="text-[var(--canvas-dark-ink-muted)] italic">
        Could not load books ({result.error}).
      </div>
    )
  }

  const rows = result.data.rows
  const current = rows.find((r) => r.status === 'CURRENT') ?? null
  const queue = rows
    .filter((r) => r.status === 'QUEUE')
    .sort((a, b) => a.order - b.order)
  const past = rows
    .filter((r) => r.status === 'PAST')
    .sort((a, b) => {
      const aT = a.finishedAt ? a.finishedAt.getTime() : 0
      const bT = b.finishedAt ? b.finishedAt.getTime() : 0
      return bT - aT
    })

  return (
    <div className="flex flex-col" style={{ gap: 26 }}>
      {/* Currently reading */}
      <section>
        <div className="sec-head">
          <h2>Currently reading</h2>
        </div>
        <section className="panel panel-pad">
          {current ? (
            <ClubBookRow book={current} canManage={canManage} locale={locale} />
          ) : (
            <p className="text-[var(--canvas-dark-ink-muted)] italic">
              {canManage
                ? 'No current book. Pick one from the queue or add a new one.'
                : 'No current book yet.'}
            </p>
          )}
        </section>
      </section>

      {/* Up next (queue) + Add-book CTA + dnd-kit reorder */}
      <ClubBooksPanelClient
        clubId={clubId}
        canManage={canManage}
        queue={queue}
        locale={locale}
      />

      {/* Past reads */}
      <section>
        <div className="sec-head">
          <h2>Past reads</h2>
          <span className="count">
            {past.length} {past.length === 1 ? 'book' : 'books'}
          </span>
        </div>
        <section className="panel">
          {past.length === 0 ? (
            <p
              className="text-[var(--canvas-dark-ink-muted)] italic"
              style={{ padding: '14px 16px' }}
            >
              No past reads yet.
            </p>
          ) : (
            <details>
              <summary
                className="cursor-pointer select-none"
                style={{
                  listStyle: 'none',
                  padding: '14px 16px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 13.5,
                  color: 'var(--canvas-dark-ink)',
                }}
              >
                Show {past.length}{' '}
                {past.length === 1 ? 'finished book' : 'finished books'}
              </summary>
              <ul className="cstack" style={{ padding: '0 16px 16px', gap: 10 }}>
                {past.map((book) => (
                  <li key={book.id}>
                    <ClubBookRow
                      book={book}
                      canManage={canManage}
                      locale={locale}
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </section>
    </div>
  )
}

export type { ClubBookRowType }
