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
    <div className="flex flex-col gap-8">
      {/* Currently reading */}
      <section>
        <h2 className="font-comfortaa font-bold text-xl text-[var(--brand)] mb-3">
          Currently reading
        </h2>
        {current ? (
          <ClubBookRow book={current} canManage={canManage} locale={locale} />
        ) : (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            {canManage
              ? 'No current book — pick one from the queue or add a new one.'
              : 'No current book yet.'}
          </p>
        )}
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
        <details>
          <summary className="cursor-pointer font-comfortaa font-bold text-xl text-[var(--brand)] mb-3 list-none flex items-center gap-2 select-none">
            <span>Past reads</span>
            <span
              className="text-xs font-normal"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              ({past.length})
            </span>
          </summary>
          {past.length === 0 ? (
            <p className="text-[var(--canvas-dark-ink-muted)] italic mt-2">
              No past reads yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 mt-3">
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
          )}
        </details>
      </section>
    </div>
  )
}

export type { ClubBookRowType }
