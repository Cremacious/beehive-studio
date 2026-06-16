import Link from 'next/link'
import { relTime } from '@/lib/utils/rel-time'

export type ClubCardData = {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  source: 'yours' | 'member' | 'suggested'
  viewerRole: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
  openJoin: boolean
  memberCount: number
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActiveAt: Date | null
  currentBookTitle: string | null
  suggestionReason: string | null
  /** Default true. Pass false on /discover where SUGGESTED is tab-implicit. */
  showRolePill?: boolean
}

type Props = { club: ClubCardData; locale: string }

type RolePillStyle = { bg: string; color: string; label: string }

function rolePillStyle(club: ClubCardData): RolePillStyle {
  if (club.source === 'suggested') {
    return {
      bg: 'oklch(0.6 0.15 150 / 0.85)',
      color: 'white',
      label: '✦ SUGGESTED',
    }
  }
  if (club.source === 'yours' && club.viewerRole === 'OWNER') {
    return {
      bg: 'oklch(from var(--brand) l c h / 0.85)',
      color: 'var(--brand-ink)',
      label: '⭐ OWNER',
    }
  }
  if (club.viewerRole === 'MODERATOR') {
    return {
      bg: 'oklch(0.6 0.15 240 / 0.85)',
      color: 'white',
      label: 'MOD',
    }
  }
  // MEMBER (or null fallback)
  return {
    bg: 'oklch(0.55 0.18 310 / 0.85)',
    color: 'white',
    label: 'MEMBER',
  }
}

// Deterministic placeholder gradient per userId — stable across renders.
function placeholderGradient(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `linear-gradient(135deg, oklch(0.55 0.12 ${hue}), oklch(0.4 0.1 ${(hue + 40) % 360}))`
}

// Parse `**bold**` markers into a tokenized array of strings + <strong> elements.
function renderSuggestionReason(reason: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(reason)) !== null) {
    if (match.index > lastIndex) {
      parts.push(reason.slice(lastIndex, match.index))
    }
    parts.push(
      <strong
        key={`b${key++}`}
        style={{ color: 'oklch(0.75 0.15 150)', fontWeight: 700 }}
      >
        {match[1]}
      </strong>,
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < reason.length) {
    parts.push(reason.slice(lastIndex))
  }
  return parts
}

function firstInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

export function ClubCard({ club, locale }: Props) {
  const href = `/${locale}/clubs/${club.id}`
  const isSuggested = club.source === 'suggested'
  const showRolePill = club.showRolePill !== false
  const pill = rolePillStyle(club)

  const cardBg = isSuggested
    ? 'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))'
    : 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))'

  // Avatar border blends with card top stop.
  const avatarBorderColor = isSuggested
    ? 'var(--canvas-dark-200)'
    : 'var(--canvas-dark-250)'

  const previews = club.memberPreviews.slice(0, 4)
  const overflow = Math.max(0, club.memberCount - 4)

  const accessPill = club.openJoin
    ? {
        bg: 'oklch(0.6 0.15 150 / 0.18)',
        color: 'oklch(0.75 0.15 150)',
        label: '🟢 OPEN',
      }
    : {
        bg: 'rgba(255,255,255,0.05)',
        color: 'var(--canvas-dark-ink-muted)',
        label: '🔒 CLOSED',
      }

  const hasDescription = club.description !== null && club.description.trim().length > 0
  const showWhySuggested = isSuggested && club.suggestionReason !== null

  const memberLabel =
    club.memberCount === 1 ? '1 MEMBER' : `${club.memberCount} MEMBERS`
  const footerRight = club.currentBookTitle
    ? `${memberLabel} · ${club.currentBookTitle.toUpperCase()}`
    : memberLabel

  return (
    <Link href={href} className="block no-underline">
      <div
        style={{
          width: 340,
          height: 360,
          background: cardBg,
          boxShadow:
            '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: isSuggested
            ? '2px dashed oklch(0.6 0.15 150 / 0.45)'
            : undefined,
        }}
      >
        {/* COVER — 340×170 fixed */}
        <div
          style={{
            height: 170,
            width: '100%',
            position: 'relative',
            flexShrink: 0,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            ...(club.coverImageUrl
              ? { backgroundImage: `url(${club.coverImageUrl})` }
              : {
                  background:
                    'linear-gradient(135deg, oklch(0.4 0.1 200), oklch(0.25 0.06 220))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }),
          }}
        >
          {!club.coverImageUrl && (
            <span
              style={{
                fontFamily: 'var(--font-comfortaa)',
                fontSize: 56,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              {firstInitial(club.name)}
            </span>
          )}

          {showRolePill && (
            <span
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 2,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 700,
                padding: '5px 9px',
                borderRadius: 999,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: pill.bg,
                color: pill.color,
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                display: 'inline-flex',
                gap: 4,
                alignItems: 'center',
              }}
            >
              {pill.label}
            </span>
          )}
        </div>

        {/* BODY — 190h, padding 12 vert × 14 horiz */}
        <div
          style={{
            height: 190,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {/* Slot 1 — title row 40h */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 10,
              height: 40,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-comfortaa)',
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--canvas-dark-ink-strong)',
                lineHeight: 1.2,
                flex: 1,
                minWidth: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {club.name}
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 700,
                padding: '3px 7px',
                borderRadius: 999,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: accessPill.bg,
                color: accessPill.color,
                display: 'inline-flex',
                gap: 3,
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {accessPill.label}
            </span>
          </div>

          {/* Slot 2 — description / why-suggested 50h */}
          <div
            style={{
              height: 50,
              flexShrink: 0,
              marginTop: 6,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {hasDescription ? (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--canvas-dark-ink-muted)',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: showWhySuggested ? 1 : 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: showWhySuggested ? 4 : 0,
                }}
              >
                {club.description}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--canvas-dark-ink-faint)',
                  fontStyle: 'italic',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: showWhySuggested ? 1 : 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: showWhySuggested ? 4 : 0,
                }}
              >
                No description yet.
              </div>
            )}
            {showWhySuggested && club.suggestionReason && (
              <div
                style={{
                  background: 'oklch(0.6 0.15 150 / 0.08)',
                  borderLeft: '2px solid oklch(0.6 0.15 150)',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  color: 'var(--canvas-dark-ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                }}
              >
                {renderSuggestionReason(club.suggestionReason)}
              </div>
            )}
          </div>

          {/* Slot 3 — member avatars 28h */}
          <div
            style={{
              height: 28,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              marginTop: 6,
            }}
          >
            {previews.length === 0 ? (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: `2px solid ${avatarBorderColor}`,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--canvas-dark-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                ?
              </div>
            ) : (
              previews.map((p, i) => (
                <div
                  key={p.userId}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: `2px solid ${avatarBorderColor}`,
                    marginLeft: i === 0 ? 0 : -6,
                    overflow: 'hidden',
                    background: p.avatarUrl
                      ? 'transparent'
                      : placeholderGradient(p.userId),
                    flexShrink: 0,
                  }}
                >
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatarUrl}
                      alt=""
                      width={24}
                      height={24}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : null}
                </div>
              ))
            )}
            {overflow > 0 && (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  marginLeft: -6,
                  border: `2px solid ${avatarBorderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  color: 'var(--canvas-dark-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                +{overflow}
              </div>
            )}
          </div>

          {/* Slot 4 — footer: pulse + activity (left), members/now-reading (right) */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              height: 28,
              flexShrink: 0,
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--canvas-dark-ink-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {club.lastActiveAt ? (
                <>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'oklch(0.65 0.18 145)',
                      boxShadow: '0 0 0 3px oklch(0.65 0.18 145 / 0.18)',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span>Active {relTime(club.lastActiveAt)}</span>
                </>
              ) : (
                <>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--canvas-dark-ink-faint)',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span>No recent activity</span>
                </>
              )}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--canvas-dark-ink-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {footerRight}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
