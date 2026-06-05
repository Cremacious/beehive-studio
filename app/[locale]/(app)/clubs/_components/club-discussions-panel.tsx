import type { BookClubMemberRole } from '@/db/schema/social'
import { listClubDiscussionsAction } from '@/lib/actions/book-clubs.actions'
import { DiscussionCard } from './discussion-card'
import { DiscussionComposerButton } from './discussion-composer-button'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  locale: string
}

export async function ClubDiscussionsPanel({ clubId, viewerRole, locale }: Props) {
  const result = await listClubDiscussionsAction({ clubId, limit: 20 })
  const discussions = result.success ? result.data.rows : []

  return (
    <div className="space-y-4">
      {viewerRole !== null && (
        <div className="flex justify-end">
          <DiscussionComposerButton clubId={clubId} />
        </div>
      )}
      {discussions.length === 0 ? (
        <p className="text-center py-8 italic text-[var(--canvas-dark-ink-muted)]">
          No discussions yet. Be the first to start one.
        </p>
      ) : (
        <ul className="space-y-3">
          {discussions.map((d) => (
            <li key={d.id}>
              <DiscussionCard discussion={d} clubId={clubId} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
