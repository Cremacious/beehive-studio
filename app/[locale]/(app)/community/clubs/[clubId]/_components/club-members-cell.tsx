import { Users } from 'lucide-react'
import { listClubMembersAction } from '@/lib/actions/book-clubs.actions'
import { ClubMembersInviteCta } from './club-empty-ctas'

const CELL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: '12px 14px',
  boxSizing: 'border-box',
}

// Deterministic avatar gradient when no photo is set
function avatarGradient(userId: string): string {
  const hash = [...userId].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue = hash % 360
  return `linear-gradient(135deg, oklch(0.3 0.12 ${hue}), oklch(0.45 0.15 ${(hue + 40) % 360}))`
}

export async function ClubMembersCell({
  clubId,
  locale: _locale,
  isModOrOwner,
}: {
  clubId: string
  locale: string
  isModOrOwner: boolean
}) {
  const result = await listClubMembersAction({ clubId })
  if (!result.success) return null

  const members = result.data.members
  const count = members.length

  // Most recently joined members shown in the preview strip
  const recent = [...members].sort(
    (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime(),
  )
  const avatarSlots = recent.slice(0, 5)
  const overflow = count - avatarSlots.length

  return (
    <div style={CELL_STYLE}>
      {/* Label */}
      <div
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
          marginBottom: 6,
          flexShrink: 0,
        }}
      >
        <Users aria-hidden="true" style={{ width: 11, height: 11 }} />
        Members
      </div>

      {/* Big stat */}
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 30,
          color: 'var(--brand)',
          lineHeight: 1,
          margin: 0,
          flexShrink: 0,
        }}
      >
        {count}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--canvas-dark-ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: '3px 0 0',
          flexShrink: 0,
        }}
      >
        {count === 1 ? 'member' : 'members'}
      </p>

      {/* Push bottom row to the end */}
      <div style={{ flex: 1 }} />

      {/* Bottom row: recent avatar stack + invite pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        {/* Overlapping avatar strip — most recently joined first */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {avatarSlots.map((member, i) => {
            const label = member.displayName ?? member.username ?? 'Member'
            return (
              <div
                key={member.userId}
                title={label}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: '1.5px solid var(--canvas-dark-200)',
                  marginLeft: i === 0 ? 0 : -7,
                  flexShrink: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  zIndex: avatarSlots.length - i,
                }}
              >
                {member.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.avatarUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: avatarGradient(member.userId),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  >
                    {label[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </div>
            )
          })}
          {overflow > 0 && (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '1.5px solid var(--canvas-dark-200)',
                marginLeft: -7,
                flexShrink: 0,
                background: 'rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
                color: 'rgba(255,255,255,0.45)',
                fontWeight: 700,
                position: 'relative',
                zIndex: 0,
              }}
            >
              +{overflow}
            </div>
          )}
        </div>

        {isModOrOwner && <ClubMembersInviteCta clubId={clubId} />}
      </div>
    </div>
  )
}
