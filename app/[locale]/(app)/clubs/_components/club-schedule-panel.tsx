import { getClubScheduleAction } from '@/lib/actions/book-clubs.actions'
import type { ClubCurrentBook } from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'
import { ScheduleItemRow } from './schedule-item-row'
import { AddScheduleItemCTA } from './add-schedule-item-cta'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  currentBook: ClubCurrentBook | null
  locale: string
}

export async function ClubSchedulePanel({
  clubId,
  viewerRole,
  currentBook,
  locale,
}: Props) {
  void locale
  const isModPlus = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'

  const result = await getClubScheduleAction(clubId, currentBook?.id)
  const items = result.success ? result.data.items : []

  return (
    <div>
      <div className="flex items-center justify-between mb-[14px]">
        <h2 className="font-comfortaa font-bold text-base text-[var(--canvas-dark-ink-strong)] m-0">
          Reading schedule
          {currentBook && (
            <>
              {' · '}
              <span className="font-medium text-[var(--canvas-dark-ink-muted)]">
                {currentBook.title}
              </span>
            </>
          )}
        </h2>
        {isModPlus && currentBook && (
          <AddScheduleItemCTA
            clubId={clubId}
            currentBookId={currentBook.id}
            currentBookTitle={currentBook.title}
          />
        )}
      </div>

      <section
        className="rounded-[var(--r-card)] p-6"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: '1px solid var(--br-card)',
        }}
      >
        {!currentBook ? (
          <p className="text-sm italic text-[var(--canvas-dark-ink-muted)]">
            Pick a current book first to schedule milestones.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm italic text-[var(--canvas-dark-ink-muted)]">
            No milestones scheduled yet.
          </p>
        ) : (
          <ul className="relative pl-2">
            {items.map((item, idx) => (
              <ScheduleItemRow
                key={item.id}
                item={item}
                clubId={clubId}
                currentBookId={currentBook.id}
                currentBookTitle={currentBook.title}
                viewerRole={viewerRole}
                isLast={idx === items.length - 1}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
