import { List } from 'lucide-react'
import type { BookClubMemberRole } from '@/db/schema/social'
import { getClubBooksAction } from '@/lib/actions/book-clubs.actions'
import { ClubBookRow } from '../../_components/club-book-row'
import { ClubBooksPanelClient } from '../../_components/club-books-panel-client'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  locale: string
}

export async function ClubQueueSection({ clubId, viewerRole, locale }: Props) {
  const canManage = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'

  const result = await getClubBooksAction({ clubId })
  if (!result.success) return null

  const rows = result.data.rows
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

  if (queue.length === 0 && past.length === 0 && !canManage) return null

  return (
    <section
      style={{
        borderRadius: 'var(--r-card)',
        background: 'linear-gradient(180deg, var(--canvas-dark-250) 0%, var(--canvas-dark-200) 100%)',
        boxShadow: 'var(--sh-card)',
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: '14px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <List aria-hidden="true" style={{ width: 15, height: 15, color: 'var(--brand)' }} />
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--brand)',
            margin: 0,
          }}
        >
          Reading queue
        </h2>
      </div>

      <div style={{ padding: '14px 20px' }}>
        {/* Queue: reorder + add-book live in ClubBooksPanelClient */}
        <ClubBooksPanelClient
          clubId={clubId}
          canManage={canManage}
          queue={queue}
          locale={locale}
        />

        {/* Past reads accordion */}
        {past.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--canvas-dark-ink-muted)',
                  margin: 0,
                }}
              >
                Past reads
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                {past.length} {past.length === 1 ? 'book' : 'books'}
              </span>
            </div>
            <details>
              <summary
                style={{
                  listStyle: 'none',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 'var(--r-btn)',
                  background: 'var(--canvas-dark-350)',
                  fontSize: 13,
                  color: 'var(--canvas-dark-ink)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  userSelect: 'none',
                }}
              >
                Show {past.length} {past.length === 1 ? 'finished book' : 'finished books'}
              </summary>
              <ul style={{ listStyle: 'none', padding: '10px 0 0', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {past.map((book) => (
                  <li key={book.id}>
                    <ClubBookRow book={book} canManage={canManage} locale={locale} />
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>
    </section>
  )
}
