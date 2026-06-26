import Link from 'next/link'
import { Users } from 'lucide-react'
import type { BookClubMemberRole } from '@/db/schema/social'
import { listClubMembersAction } from '@/lib/actions/book-clubs.actions'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  locale: string
}

const ROLE_LABEL: Record<BookClubMemberRole, string> = {
  OWNER: 'Owner',
  MODERATOR: 'Mod',
  MEMBER: 'Member',
}

const ROLE_PT: Record<BookClubMemberRole, string> = {
  OWNER: 'var(--brand)',
  MODERATOR: 'oklch(0.65 0.15 260)',
  MEMBER: 'var(--canvas-dark-ink-muted)',
}

export async function ClubMembersSection({ clubId, viewerRole, locale }: Props) {
  const result = await listClubMembersAction({ clubId })
  if (!result.success) return null

  const members = result.data.members

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
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users aria-hidden="true" style={{ width: 15, height: 15, color: 'var(--brand)' }} />
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--brand)',
              margin: 0,
            }}
          >
            Members
          </h2>
        </div>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          {members.length}
        </span>
      </div>

      {/* Compact member grid */}
      <ul
        style={{
          listStyle: 'none',
          padding: '10px 20px 14px',
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))',
          gap: 6,
        }}
      >
        {members.map((member) => {
          const displayName = member.displayName ?? member.username ?? 'Member'
          const roleColor = ROLE_PT[member.role]

          return (
            <li key={member.userId}>
              {member.username ? (
                <Link
                  href={`/${locale}/u/${member.username}`}
                  style={{ textDecoration: 'none' }}
                >
                  <MemberTile
                    avatarUrl={member.avatarUrl}
                    displayName={displayName}
                    username={member.username}
                    roleLabel={ROLE_LABEL[member.role]}
                    roleColor={roleColor}
                    isOwner={member.role === 'OWNER'}
                  />
                </Link>
              ) : (
                <MemberTile
                  avatarUrl={member.avatarUrl}
                  displayName={displayName}
                  username={null}
                  roleLabel={ROLE_LABEL[member.role]}
                  roleColor={roleColor}
                  isOwner={member.role === 'OWNER'}
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function MemberTile({
  avatarUrl,
  displayName,
  username,
  roleLabel,
  roleColor,
  isOwner,
}: {
  avatarUrl: string | null
  displayName: string
  username: string | null
  roleLabel: string
  roleColor: string
  isOwner: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 'var(--r-row)',
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        minWidth: 0,
        cursor: username ? 'pointer' : 'default',
      }}
    >
      {/* Avatar */}
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
            border: isOwner ? '1.5px solid var(--brand)' : '1.5px solid rgba(255,255,255,0.1)',
          }}
        />
      ) : (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'linear-gradient(135deg, var(--canvas-dark-400), var(--canvas-dark-200))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'var(--canvas-dark-ink-muted)',
            fontWeight: 600,
            border: isOwner ? '1.5px solid var(--brand)' : '1.5px solid rgba(255,255,255,0.1)',
          }}
        >
          {displayName[0]?.toUpperCase() ?? '?'}
        </div>
      )}

      {/* Name + role */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            color: 'var(--canvas-dark-ink-strong)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: roleColor,
          }}
        >
          {roleLabel}
        </p>
      </div>
    </div>
  )
}
