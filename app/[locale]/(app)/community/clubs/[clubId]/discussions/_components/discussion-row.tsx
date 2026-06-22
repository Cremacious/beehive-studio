import Link from 'next/link'
import { MessageCircle, Heart, Pin } from 'lucide-react'
import type { ClubDiscussionRow } from '@/lib/actions/book-clubs.actions'

export function relTime(d: Date | string): string {
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

export function Avatar({ url, fallback }: { url: string | null; fallback: string }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--canvas-dark-ink-muted)',
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        fallback
      )}
    </div>
  )
}

export function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        color: 'var(--canvas-dark-ink-muted)',
        margin: '4px 0 8px',
      }}
    >
      <span>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

export function DiscussionRow({
  d,
  locale,
  clubId,
  pinned,
}: {
  d: ClubDiscussionRow
  locale: string
  clubId: string
  pinned?: boolean
}) {
  const snippet = (d.title || d.content)?.slice(0, 120) ?? 'Discussion'
  return (
    <Link
      href={`/${locale}/community/clubs/${clubId}/discussions/${d.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 'var(--r-row)',
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          borderLeft: pinned ? '2px solid var(--brand)' : '2px solid transparent',
        }}
      >
        <Avatar
          url={d.author.avatarUrl}
          fallback={(d.author.username ?? d.author.displayName ?? '?')[0]?.toUpperCase() ?? '?'}
        />
        {pinned && (
          <Pin
            aria-hidden="true"
            style={{ width: 13, height: 13, color: 'var(--brand)', flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: '0 0 3px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--canvas-dark-ink-strong)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {snippet}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            <span style={{ color: 'var(--brand)' }}>
              @{d.author.username ?? 'unknown'}
            </span>
            <span style={{ margin: '0 6px' }}>·</span>
            <span>{relTime(d.createdAt)}</span>
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MessageCircle aria-hidden="true" style={{ width: 11, height: 11 }} />
            {d.replyCount}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Heart aria-hidden="true" style={{ width: 11, height: 11 }} />
            {d.likeCount}
          </span>
        </div>
      </div>
    </Link>
  )
}
