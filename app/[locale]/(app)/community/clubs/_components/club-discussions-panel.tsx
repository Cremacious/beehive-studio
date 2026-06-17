import { Pin } from 'lucide-react'
import type { BookClubMemberRole } from '@/db/schema/social'
import { listClubDiscussionsAction } from '@/lib/actions/book-clubs.actions'
import { DiscussionCard } from './discussion-card'
import { DiscussionComposerButton } from './discussion-composer-button'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  locale: string
}

export async function ClubDiscussionsPanel({
  clubId,
  viewerRole,
  locale,
}: Props) {
  const result = await listClubDiscussionsAction({ clubId, limit: 20 })
  const discussions = result.success ? result.data.rows : []

  const pinned = discussions.filter((d) => d.isPinned)
  const others = discussions.filter((d) => !d.isPinned)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--canvas-dark-ink-strong)',
            margin: 0,
          }}
        >
          Discussions
        </h2>
        {viewerRole !== null && <DiscussionComposerButton clubId={clubId} />}
      </div>

      {discussions.length === 0 ? (
        <p
          style={{
            textAlign: 'center',
            padding: '32px 0',
            fontStyle: 'italic',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          No discussions yet. Be the first to start one.
        </p>
      ) : (
        <>
          {pinned.length > 0 && (
            <>
              <div className="pinned-divider">
                <Pin
                  aria-hidden="true"
                  style={{ color: 'var(--brand)', width: 13, height: 13 }}
                />
                <span>Pinned</span>
                <span className="ln" />
              </div>
              <ul className="cstack">
                {pinned.map((d) => (
                  <li key={d.id}>
                    <DiscussionCard
                      discussion={d}
                      clubId={clubId}
                      locale={locale}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          {others.length > 0 && (
            <>
              {pinned.length > 0 && (
                <div className="pinned-divider">
                  <span>All discussions</span>
                  <span className="ln" />
                </div>
              )}
              <ul className="cstack">
                {others.map((d) => (
                  <li key={d.id}>
                    <DiscussionCard
                      discussion={d}
                      clubId={clubId}
                      locale={locale}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
