import { Info, Globe, Lock, Users, Tag, ScrollText } from 'lucide-react'
import type { ClubSummary } from '@/lib/actions/book-clubs.actions'

type Props = {
  club: ClubSummary
}

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function ClubInfoSection({ club }: Props) {
  const hasContent =
    !!club.description ||
    !!club.rules ||
    (club.tags && club.tags.length > 0)

  if (!hasContent) return null

  const VisibilityIcon =
    club.visibility === 'PUBLIC' ? Globe : club.visibility === 'FRIENDS' ? Users : Lock
  const visibilityLabel =
    club.visibility === 'PUBLIC'
      ? 'Public'
      : club.visibility === 'FRIENDS'
        ? 'Friends only'
        : 'Private'

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
      {/* Header */}
      <div
        style={{
          padding: '14px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Info aria-hidden="true" style={{ width: 15, height: 15, color: 'var(--brand)' }} />
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--brand)',
            margin: 0,
          }}
        >
          About this club
        </h2>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Description */}
        {club.description && (
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: 'var(--canvas-dark-ink)',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
              }}
            >
              {club.description}
            </p>
          </div>
        )}

        {/* Rules */}
        {club.rules && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                marginBottom: 6,
              }}
            >
              <ScrollText aria-hidden="true" style={{ width: 12, height: 12, color: 'var(--canvas-dark-ink-muted)' }} />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                Club rules
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--canvas-dark-ink)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                padding: '10px 12px',
                background: 'var(--canvas-dark-350)',
                borderRadius: 'var(--r-row)',
                borderLeft: '3px solid rgba(255,195,0,0.35)',
              }}
            >
              {club.rules}
            </p>
          </div>
        )}

        {/* Tags */}
        {club.tags && club.tags.length > 0 && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                marginBottom: 8,
              }}
            >
              <Tag aria-hidden="true" style={{ width: 12, height: 12, color: 'var(--canvas-dark-ink-muted)' }} />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                Tags
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {club.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'var(--canvas-dark-350)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 12,
                    color: 'var(--canvas-dark-ink)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meta strip */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 16px',
            paddingTop: 4,
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            <VisibilityIcon aria-hidden="true" style={{ width: 12, height: 12 }} />
            {visibilityLabel}
          </span>
          {club.openJoin && (
            <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>
              Open to join
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>
            Est. {fmtDate(club.createdAt)}
          </span>
        </div>
      </div>
    </section>
  )
}
