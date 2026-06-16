import Link from 'next/link'
import { relTime } from '@/lib/utils/rel-time'

export type HiveCardData = {
  id: string
  name: string
  bookTitle: string | null
  source: 'yours' | 'member' | 'suggested'
  viewerRole: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER' | null
  memberCount: number
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActiveAt: Date | null
  suggestionReason: string | null
  /** Optional: word-goal percentage (0-100). When non-null + > 0, footer shows WORD GOAL · N%. */
  wordGoalPct?: number | null
  /** Optional: when false, hide the role pill (e.g. on /discover surfaces where SUGGESTED is implicit). Default true. */
  showRolePill?: boolean
}

type Props = { hive: HiveCardData; locale: string }

type RolePillStyle = { bg: string; color: string; label: string }

function rolePillStyle(hive: HiveCardData): RolePillStyle {
  if (hive.source === 'yours') {
    return {
      bg: 'oklch(from var(--brand) l c h / 0.18)',
      color: 'var(--brand)',
      label: '⭐ OWNER',
    }
  }
  if (hive.source === 'member') {
    if (hive.viewerRole === 'MODERATOR') {
      return {
        bg: 'oklch(0.6 0.15 240 / 0.18)',
        color: 'oklch(0.75 0.15 240)',
        label: 'MOD',
      }
    }
    return {
      bg: 'oklch(0.55 0.18 310 / 0.18)',
      color: 'oklch(0.75 0.16 310)',
      label: 'MEMBER',
    }
  }
  return {
    bg: 'oklch(0.6 0.15 150 / 0.18)',
    color: 'oklch(0.75 0.15 150)',
    label: '✦ SUGGESTED',
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
      <strong key={`b${key++}`} style={{ color: 'oklch(0.75 0.15 150)' }}>
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

export function HiveCard({ hive, locale }: Props) {
  const href = `/${locale}/hive/${hive.id}`
  const isSuggested = hive.source === 'suggested'
  const showRolePill = hive.showRolePill !== false

  const pill = rolePillStyle(hive)

  const eyebrow = hive.bookTitle
    ? `AROUND ${hive.bookTitle.toUpperCase()}`
    : 'STANDALONE HIVE'

  const cardBg = isSuggested
    ? 'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))'
    : 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))'

  // Match avatar border to the card's top gradient stop so rings blend.
  const avatarBorderColor = isSuggested
    ? 'var(--canvas-dark-200)'
    : 'var(--canvas-dark-250)'

  const previews = hive.memberPreviews.slice(0, 4)
  const overflow = Math.max(0, hive.memberCount - 4)

  const showWordGoal =
    hive.wordGoalPct !== null &&
    hive.wordGoalPct !== undefined &&
    hive.wordGoalPct > 0

  const memberLabel =
    hive.memberCount === 1 ? '1 member' : `${hive.memberCount} members`

  return (
    <Link href={href} className="block no-underline w-full h-full">
      <div
        className="h-full flex flex-col items-center text-center gap-3"
        style={{
          position: 'relative',
          background: cardBg,
          borderRadius: 14,
          boxShadow: 'var(--sh-tile)',
          minHeight: 220,
          padding: '18px 16px 14px',
          border: isSuggested
            ? '2px dashed oklch(0.6 0.15 150 / 0.45)'
            : undefined,
        }}
      >
        {/* Role pill */}
        {showRolePill && (
          <span
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '3px 7px',
              borderRadius: 999,
              background: pill.bg,
              color: pill.color,
              fontWeight: 600,
            }}
          >
            {pill.label}
          </span>
        )}

        {/* Avatar stack hero */}
        <div className="flex justify-center" style={{ marginTop: 4 }}>
          {previews.length === 0 ? (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: `3px solid ${avatarBorderColor}`,
                background: 'rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ?
            </div>
          ) : (
            previews.map((p, i) => (
              <div
                key={p.userId}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: `3px solid ${avatarBorderColor}`,
                  marginLeft: i === 0 ? 0 : -10,
                  overflow: 'hidden',
                  background: p.avatarUrl
                    ? 'transparent'
                    : placeholderGradient(p.userId),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
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
                width: 36,
                height: 36,
                borderRadius: 999,
                border: `3px solid ${avatarBorderColor}`,
                marginLeft: -10,
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--canvas-dark-ink-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              +{overflow}
            </div>
          )}
        </div>

        {/* Hive name */}
        <div
          style={{
            fontFamily: 'var(--font-comfortaa)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--canvas-dark-ink-strong)',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {hive.name}
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--canvas-dark-ink-muted)',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {eyebrow}
        </div>

        {/* Why-suggested line */}
        {hive.suggestionReason && (
          <div
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'oklch(0.6 0.15 150 / 0.08)',
              borderLeft: '2px solid oklch(0.6 0.15 150)',
              padding: '6px 10px',
              borderRadius: 4,
              fontSize: 11,
              color: 'var(--canvas-dark-ink)',
            }}
          >
            {renderSuggestionReason(hive.suggestionReason)}
          </div>
        )}

        {/* Footer */}
        <div
          className="mt-auto w-full pt-2 flex justify-between items-center"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.04)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          <div className="flex items-center gap-2">
            {hive.lastActiveAt ? (
              <>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'oklch(0.65 0.18 145)',
                    boxShadow: '0 0 0 3px oklch(0.65 0.18 145 / 0.18)',
                    display: 'inline-block',
                  }}
                />
                <span>Active {relTime(hive.lastActiveAt)}</span>
              </>
            ) : (
              <span>No activity yet</span>
            )}
          </div>
          <div>
            {showWordGoal
              ? `WORD GOAL · ${hive.wordGoalPct}%`
              : memberLabel}
          </div>
        </div>
      </div>
    </Link>
  )
}
