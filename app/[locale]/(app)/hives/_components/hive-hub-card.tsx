import Link from 'next/link'
import type { CommunityHiveRow } from '@/lib/actions/hives-hub.actions'
import { relTime } from '@/lib/utils/rel-time'

type Props = {
  hive: CommunityHiveRow
  locale: string
}

type RolePillStyle = { bg: string; color: string; label: string }

function rolePillStyle(hive: CommunityHiveRow): RolePillStyle {
  if (hive.source === 'yours') {
    return {
      bg: 'oklch(from var(--brand) l c h / 0.18)',
      color: 'var(--brand)',
      label: 'OWNER',
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
    bg: 'rgba(255,255,255,0.06)',
    color: 'var(--canvas-dark-ink-muted)',
    label: 'OPEN',
  }
}

export function HiveHubCard({ hive, locale }: Props) {
  const href =
    hive.source === 'open'
      ? `/${locale}/discover?tab=hives`
      : `/${locale}/hive/${hive.id}`

  const pill = rolePillStyle(hive)
  const firstLetter = hive.name.trim().charAt(0).toUpperCase() || 'H'

  const eyebrow = hive.bookTitle
    ? `AROUND ${hive.bookTitle}`
    : 'STANDALONE HIVE'

  const memberLabel =
    hive.memberCount === 1 ? '1 member' : `${hive.memberCount} members`

  return (
    <Link href={href} className="block no-underline w-full h-full">
      <div
        className="overflow-hidden h-full flex flex-col"
        style={{
          position: 'relative',
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 14,
          boxShadow: 'var(--sh-tile)',
          minHeight: 200,
        }}
      >
        {/* Role pill */}
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

        <div className="p-4 flex-1 flex flex-col gap-3">
          {/* Top row: thumb + name/eyebrow */}
          <div className="flex items-center gap-3 pr-14">
            <div className="flex-shrink-0">
              {hive.bookCoverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hive.bookCoverUrl}
                  alt=""
                  width={44}
                  height={44}
                  style={{
                    width: 44,
                    height: 44,
                    objectFit: 'cover',
                    borderRadius: 8,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background:
                      'linear-gradient(135deg, var(--canvas-dark-200), var(--canvas-dark-400))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-comfortaa)',
                    fontWeight: 700,
                    fontSize: 18,
                    color: 'var(--canvas-dark-ink)',
                  }}
                >
                  {firstLetter}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
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
              <div
                className="mt-1 truncate"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                {eyebrow}
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer */}
          <div
            className="flex justify-between items-center pt-2"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: 11,
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
                  <span>{relTime(hive.lastActiveAt)}</span>
                </>
              ) : (
                <span>No activity yet</span>
              )}
            </div>
            <div>{memberLabel}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}
