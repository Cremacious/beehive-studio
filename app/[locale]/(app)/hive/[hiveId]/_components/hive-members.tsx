'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import {
  removeMemberAction,
  updateMemberRoleAction,
} from '@/lib/actions/hive.actions'
import { HivePill } from './hive-pill'
import { toastNetworkError } from '@/lib/errors/notify'

type Role = 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'

type Props = {
  hiveId: string
  members: HiveMemberRow[]
  isOwner: boolean
  isEditor: boolean
  currentUserId: string
}

const ASSIGNABLE_ROLES: Role[] = ['MODERATOR', 'CONTRIBUTOR', 'BETA_READER']

const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Owner',
  MODERATOR: 'Moderator',
  CONTRIBUTOR: 'Contributor',
  BETA_READER: 'Beta reader',
}

const ROLE_TOKEN: Record<Role, string> = {
  OWNER: '--role-owner',
  MODERATOR: '--role-moderator',
  CONTRIBUTOR: '--role-contributor',
  BETA_READER: '--role-reader',
}

function formatJoinDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Onboarding-chosen name only (issue #55). Falls back to @username, then a
// neutral label — NEVER the Google/OAuth name.
function memberName(m: HiveMemberRow): string {
  return m.displayName ?? (m.username ? `@${m.username}` : 'Member')
}

export function HiveMembers({
  hiveId,
  members: initialMembers,
  isOwner,
  isEditor,
  currentUserId,
}: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => {
      const name = (m.displayName ?? '').toLowerCase()
      const handle = (m.username ?? '').toLowerCase()
      return name.includes(q) || handle.includes(q)
    })
  }, [members, query])

  async function handleRemove(userId: string) {
    const prev = members
    setMembers(prev.filter((m) => m.userId !== userId))
    try {
      const result = await removeMemberAction(hiveId, userId)
      if (!result.success) {
        setMembers(prev)
        toast.error(result.error || 'Could not remove member')
      } else {
        toast.success('Member removed')
      }
    } catch {
      setMembers(prev)
      toastNetworkError()
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    const prev = members
    setMembers(prev.map((m) => (m.userId === userId ? { ...m, role } : m)))
    try {
      const result = await updateMemberRoleAction(hiveId, userId, role)
      if (!result.success) {
        setMembers(prev)
        toast.error(result.error || 'Could not update role')
      } else {
        toast.success('Role updated')
      }
    } catch {
      setMembers(prev)
      toastNetworkError()
    }
  }

  return (
    <div className="px-6 py-5 flex flex-col gap-4 max-md:px-4 max-md:py-4">
      {/* Search toolbar */}
      <div className="flex items-center justify-between gap-3 max-md:flex-col-reverse max-md:items-stretch">
        <span
          className="font-mono uppercase"
          style={{
            fontSize: '10px',
            letterSpacing: '0.14em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          All members · {members.length}
        </span>
        <div
          className="inline-flex items-center gap-2 px-3 w-full md:w-[240px]"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            borderRadius: 'var(--r-pill)',
            height: 34,
          }}
        >
          <Search size={13} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            className="flex-1 bg-transparent border-0 outline-none placeholder:text-[var(--canvas-dark-ink-faint)]"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>
      </div>

      {/* Forum-table members list (desktop) */}
      <div
        className="overflow-hidden max-md:hidden"
        style={{
          borderRadius: 'var(--r-row)',
          border: 'var(--br-card)',
        }}
      >
        {/* Header strip */}
        <div
          className="grid items-center gap-3 px-5 py-2.5 font-mono uppercase hive-row-grid max-md:hidden"
          style={{
            gridTemplateColumns: 'minmax(0, 1fr) 150px 110px 48px',
            background: 'var(--canvas-dark-100)',
            borderBottom: 'var(--br-card)',
            color: 'var(--canvas-dark-ink-muted)',
            fontSize: 10,
            letterSpacing: '0.14em',
          }}
        >
          <span>Member</span>
          <span>Role</span>
          <span>Joined</span>
          <span></span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p
              className="italic"
              style={{
                fontSize: 13,
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              {query
                ? 'No members match that search.'
                : 'No members yet.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--canvas-dark-300)]/40">
            {filtered.map((m) => {
              const role = m.role as Role
              const isSelf = m.userId === currentUserId
              const isMemberOwner = role === 'OWNER'
              const canChangeRole = isOwner && !isSelf && !isMemberOwner
              const canRemove = (isOwner || isEditor) && !isSelf && !isMemberOwner

              return (
                <li
                  key={m.id}
                  className="grid items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.025] hive-row-grid max-md:items-start"
                  style={{
                    gridTemplateColumns: 'minmax(0, 1fr) 150px 110px 48px',
                  }}
                >
                  {/* Member */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 font-comfortaa font-semibold"
                      style={{
                        width: 34,
                        height: 34,
                        fontSize: 13,
                        background: 'oklch(from var(--brand) l c h / 0.18)',
                        color: 'var(--brand)',
                      }}
                    >
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (memberName(m)[0] ?? '?').toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-comfortaa font-bold truncate"
                        style={{
                          fontSize: 14,
                          color: 'var(--canvas-dark-ink-strong)',
                          margin: 0,
                        }}
                      >
                        {memberName(m)}
                        {isSelf && (
                          <span
                            className="ml-2 font-mono uppercase"
                            style={{
                              fontSize: 9.5,
                              letterSpacing: '0.14em',
                              color: 'var(--canvas-dark-ink-muted)',
                              fontWeight: 400,
                            }}
                          >
                            You
                          </span>
                        )}
                      </p>
                      <p
                        className="font-mono truncate"
                        style={{
                          fontSize: 10.5,
                          letterSpacing: '0.06em',
                          color: 'var(--canvas-dark-ink-muted)',
                          margin: '2px 0 0',
                        }}
                      >
                        {m.displayName && m.username ? `@${m.username}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="min-w-0">
                    {canChangeRole ? (
                      <select
                        value={role}
                        onChange={(e) =>
                          handleRoleChange(m.userId, e.target.value as Role)
                        }
                        style={
                          {
                            ['--pill-accent' as string]: `var(${ROLE_TOKEN[role]})`,
                            appearance: 'none',
                            cursor: 'pointer',
                            padding: '5px 26px 5px 12px',
                            borderRadius: 'var(--r-pill)',
                            border:
                              '1px solid oklch(from var(--pill-accent) l c h / 0.3)',
                            background:
                              'oklch(from var(--pill-accent) l c h / 0.14)',
                            color: 'var(--pill-accent)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 8px center',
                            backgroundSize: '10px',
                          } as React.CSSProperties
                        }
                        className="focus:outline-none"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <HivePill token={ROLE_TOKEN[role]}>
                        {ROLE_LABEL[role]}
                      </HivePill>
                    )}
                  </div>

                  {/* Joined */}
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--canvas-dark-ink-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {formatJoinDate(m.joinedAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(m.userId)}
                        aria-label={`Remove ${memberName(m)}`}
                        style={{
                          color: 'var(--canvas-dark-ink-muted)',
                          borderRadius: 'var(--r-btn)',
                          background: 'transparent',
                          border: 0,
                          width: 30,
                          height: 30,
                        }}
                        className="inline-flex items-center justify-center transition-colors hover:bg-white/[0.05] hover:text-[var(--canvas-dark-ink-strong)]"
                      >
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Compact list (mobile, issue #50, variant B) */}
      <ul className="md:hidden flex flex-col">
        {filtered.length === 0 ? (
          <li
            className="py-8 text-center italic"
            style={{ fontSize: 13, color: 'var(--canvas-dark-ink-muted)' }}
          >
            {query ? 'No members match that search.' : 'No members yet.'}
          </li>
        ) : (
          filtered.map((m) => {
            const role = m.role as Role
            const isSelf = m.userId === currentUserId
            const isMemberOwner = role === 'OWNER'
            const canChangeRole = isOwner && !isSelf && !isMemberOwner
            const canRemove = (isOwner || isEditor) && !isSelf && !isMemberOwner

            return (
              <li
                key={m.id}
                className="flex items-center gap-2.5 py-3 border-b border-[var(--canvas-dark-300)]/30 last:border-b-0"
              >
                <div
                  className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 font-comfortaa font-semibold"
                  style={{
                    width: 34,
                    height: 34,
                    fontSize: 13,
                    background: 'oklch(from var(--brand) l c h / 0.18)',
                    color: 'var(--brand)',
                  }}
                >
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (memberName(m)[0] ?? '?').toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className="font-comfortaa font-bold truncate"
                    style={{
                      fontSize: 14,
                      color: 'var(--canvas-dark-ink-strong)',
                      margin: 0,
                    }}
                  >
                    {memberName(m)}
                    {isSelf && (
                      <span
                        className="ml-2 font-mono uppercase"
                        style={{
                          fontSize: 9.5,
                          letterSpacing: '0.14em',
                          color: 'var(--canvas-dark-ink-muted)',
                          fontWeight: 400,
                        }}
                      >
                        You
                      </span>
                    )}
                  </p>
                  {canChangeRole ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <select
                        value={role}
                        onChange={(e) =>
                          handleRoleChange(m.userId, e.target.value as Role)
                        }
                        aria-label={`Role for ${memberName(m)}`}
                        style={
                          {
                            ['--pill-accent' as string]: `var(${ROLE_TOKEN[role]})`,
                            appearance: 'none',
                            cursor: 'pointer',
                            padding: '0 16px 0 0',
                            border: 0,
                            background: 'transparent',
                            color: 'var(--pill-accent)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 1px center',
                            backgroundSize: '9px',
                          } as React.CSSProperties
                        }
                        className="focus:outline-none"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 10,
                          color: 'var(--canvas-dark-ink-muted)',
                        }}
                      >
                        · joined {formatJoinDate(m.joinedAt)}
                      </span>
                    </div>
                  ) : (
                    <p
                      className="font-mono uppercase truncate"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.06em',
                        margin: '3px 0 0',
                      }}
                    >
                      <span style={{ color: `var(${ROLE_TOKEN[role]})`, fontWeight: 700 }}>
                        {ROLE_LABEL[role]}
                      </span>
                      <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                        {' · joined '}
                        {formatJoinDate(m.joinedAt)}
                      </span>
                    </p>
                  )}
                </div>

                {canRemove ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId)}
                    aria-label={`Remove ${memberName(m)}`}
                    style={{
                      color: 'var(--canvas-dark-ink-muted)',
                      borderRadius: 'var(--r-btn)',
                      background: 'transparent',
                      border: 0,
                      width: 32,
                      height: 32,
                    }}
                    className="inline-flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/[0.05] hover:text-[var(--canvas-dark-ink-strong)]"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
