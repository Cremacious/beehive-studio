import Link from 'next/link'
import { MessageCircle, Heart, ChevronRight, Pin } from 'lucide-react'
import { listClubDiscussionsAction } from '@/lib/actions/book-clubs.actions'
import { ClubDiscussionsEmptyCta } from './club-empty-ctas'
import { NewDiscussionPill } from './new-discussion-pill'

const ACCENT_GRADIENTS = [
  'linear-gradient(150deg, oklch(0.6 0.13 250), oklch(0.46 0.1 280))',
  'linear-gradient(150deg, oklch(0.62 0.13 20), oklch(0.48 0.1 12))',
  'linear-gradient(150deg, oklch(0.6 0.12 155), oklch(0.46 0.1 165))',
  'linear-gradient(150deg, oklch(0.6 0.12 290), oklch(0.46 0.1 300))',
  'linear-gradient(150deg, oklch(0.7 0.13 70), oklch(0.55 0.12 55))',
]
function gradientFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return ACCENT_GRADIENTS[Math.abs(h) % ACCENT_GRADIENTS.length]
}

function relTime(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const dy = Math.floor(h / 24)
  if (dy < 7) return `${dy}d ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export async function ClubDiscussionsCell({
  clubId,
  locale,
  isMember,
}: {
  clubId: string
  locale: string
  isMember: boolean
}) {
  const result = await listClubDiscussionsAction({ clubId, limit: 2 })
  const rows = result.success ? result.data.rows.slice(0, 2) : []

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 14px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          flexShrink: 0,
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--brand)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <MessageCircle aria-hidden="true" style={{ width: 11, height: 11 }} />
          Discussions
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isMember && <NewDiscussionPill clubId={clubId} />}
          <Link
            href={`/${locale}/community/clubs/${clubId}/discussions`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: '3px 9px 3px 10px',
              borderRadius: 999,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.10)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              color: 'var(--canvas-dark-ink-muted)',
              textDecoration: 'none',
            }}
          >
            View all
            <ChevronRight aria-hidden="true" style={{ width: 11, height: 11 }} />
          </Link>
        </div>
      </div>

      {/* Rows */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {rows.length === 0 ? (
          isMember ? (
            <ClubDiscussionsEmptyCta clubId={clubId} />
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontStyle: 'italic',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              No discussions yet.
            </p>
          )
        ) : (
          rows.map((d) => {
            const handle = d.author.username ?? d.author.displayName ?? 'unknown'
            const initials = handle.slice(0, 2).toUpperCase()
            const seed = d.author.username ?? d.author.userId ?? handle
            return (
              <Link
                key={d.id}
                href={`/${locale}/community/clubs/${clubId}/discussions/${d.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 10px',
                    borderRadius: 'var(--r-row)',
                    background:
                      'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    boxShadow: 'var(--sh-tile)',
                    borderLeft: d.isPinned
                      ? '2px solid var(--brand)'
                      : '2px solid transparent',
                    overflow: 'hidden',
                  }}
                >
                  {/* Avatar */}
                  {d.author.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.author.avatarUrl}
                      alt=""
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 10,
                        color: 'white',
                        background: gradientFor(seed),
                      }}
                    >
                      {initials}
                    </span>
                  )}

                  {/* Title + author/time */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        color: 'var(--canvas-dark-ink-strong)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {d.isPinned && (
                        <Pin
                          aria-hidden="true"
                          style={{ width: 10, height: 10, color: 'var(--brand)', flexShrink: 0 }}
                        />
                      )}
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.title || 'Discussion'}
                      </span>
                    </p>
                    <p
                      style={{
                        margin: '1px 0 0',
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--canvas-dark-ink-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: 'var(--brand)' }}>@{handle}</span>
                      <span style={{ margin: '0 5px' }}>·</span>
                      <span>{relTime(d.createdAt)}</span>
                    </p>
                  </div>

                  {/* Stats */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexShrink: 0,
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--canvas-dark-ink-muted)',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Heart aria-hidden="true" style={{ width: 10, height: 10 }} />
                      {d.likeCount ?? 0}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <MessageCircle aria-hidden="true" style={{ width: 10, height: 10 }} />
                      {d.replyCount ?? 0}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
