'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X, Search, Copy, UserPlus, Check } from 'lucide-react'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import {
  inviteMemberByUsernameAction,
  generateInviteLinkAction,
  removeMemberAction,
  updateMemberRoleAction,
} from '@/lib/actions/hive.actions'
import type { FriendSummary } from '@/lib/actions/friendships.actions'
import { FREE_HIVE_MEMBER_LIMIT } from '@/lib/premium'
import { HivePill } from './hive-pill'
import { HiveSectionDivider } from './hive-section-divider'

type Role = 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'

type Props = {
  hiveId: string
  locale: string
  members: HiveMemberRow[]
  friends: FriendSummary[]
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

export function HiveMembers({
  hiveId,
  locale,
  members: initialMembers,
  friends,
  isOwner,
  isEditor,
  currentUserId,
}: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const canInvite = isOwner || isEditor

  async function handleGenerateLink() {
    setGenerating(true)
    const result = await generateInviteLinkAction(hiveId)
    setGenerating(false)
    if (result.success) {
      setInviteLink(
        `${window.location.origin}/${locale}/hive/invite/${result.data.token}`,
      )
      toast.success('Invite link generated')
    } else {
      toast.error(result.error || 'Could not generate link')
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  async function handleRemove(userId: string) {
    const prev = members
    setMembers(prev.filter((m) => m.userId !== userId))
    const result = await removeMemberAction(hiveId, userId)
    if (!result.success) {
      setMembers(prev)
      toast.error(result.error || 'Could not remove member')
    } else {
      toast.success('Member removed')
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    const prev = members
    setMembers(prev.map((m) => (m.userId === userId ? { ...m, role } : m)))
    const result = await updateMemberRoleAction(hiveId, userId, role)
    if (!result.success) {
      setMembers(prev)
      toast.error(result.error || 'Could not update role')
    } else {
      toast.success('Role updated')
    }
  }

  return (
    <>
      {canInvite && (
        <>
          <HiveSectionDivider label="Invite link" hideTopBorder>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-stretch">
                <div
                  className="flex-1 min-w-0 flex items-center px-[14px] font-mono text-[12.5px] overflow-hidden"
                  style={{
                    height: 42,
                    borderRadius: 'var(--r-row)',
                    background: 'var(--canvas-dark-100)',
                    boxShadow: 'var(--sh-inset)',
                    color: 'var(--canvas-dark-ink)',
                  }}
                >
                  <span className="truncate whitespace-nowrap">
                    {inviteLink ?? 'Generate a shareable invite link…'}
                  </span>
                </div>
                {inviteLink ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      style={{
                        background:
                          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                        boxShadow: 'var(--sh-tile)',
                        borderRadius: 'var(--r-btn)',
                        color: 'var(--canvas-dark-ink)',
                        height: 42,
                      }}
                      className="inline-flex items-center gap-1.5 px-4 font-geist text-[13px] transition-all hover:-translate-y-px hover:text-[var(--canvas-dark-ink-strong)]"
                    >
                      <Copy size={15} strokeWidth={1.9} />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateLink}
                      disabled={generating}
                      style={{
                        background:
                          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                        boxShadow: 'var(--sh-tile)',
                        borderRadius: 'var(--r-btn)',
                        color: 'var(--canvas-dark-ink)',
                        height: 42,
                      }}
                      className="inline-flex items-center px-4 font-geist text-[13px] transition-all hover:-translate-y-px hover:text-[var(--canvas-dark-ink-strong)] disabled:opacity-50"
                    >
                      {generating ? '…' : 'Regenerate'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateLink}
                    disabled={generating}
                    style={{
                      background: 'var(--brand)',
                      color: 'var(--brand-ink)',
                      borderRadius: 'var(--r-pill)',
                      boxShadow: 'var(--sh-tile)',
                      height: 42,
                    }}
                    className="inline-flex items-center px-4 font-geist font-semibold text-[13px] transition-transform hover:-translate-y-px hover:bg-[var(--brand-hover)] active:translate-y-0 active:bg-[var(--brand-active)] disabled:opacity-50"
                  >
                    {generating ? '…' : 'Generate'}
                  </button>
                )}
              </div>
              <p
                className="mt-2 font-mono text-[11px] tracking-wider"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {members.length} / {FREE_HIVE_MEMBER_LIMIT} members
              </p>
            </div>
          </HiveSectionDivider>

          <HiveSectionDivider label="Invite friends">
            <InviteFriendsPanel
              hiveId={hiveId}
              friends={friends}
              memberUserIds={new Set(members.map((m) => m.userId))}
            />
          </HiveSectionDivider>
        </>
      )}

      <HiveSectionDivider label="Members" hideTopBorder={!canInvite}>
        <div
          className="overflow-hidden"
          style={{ borderRadius: 'var(--r-row)', border: 'var(--br-card)' }}
        >
          <div
            className="grid grid-cols-[1fr_140px_60px] gap-3 px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              background: 'var(--canvas-dark-100)',
              borderTop: 'var(--br-card)',
              borderBottom: 'var(--br-card)',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            <span>Member</span>
            <span>Role</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-[var(--canvas-dark-300)]/40">
            {members.map((m) => {
              const role = m.role as Role
              const isSelf = m.userId === currentUserId
              const isMemberOwner = role === 'OWNER'
              const canChangeRole = isOwner && !isSelf && !isMemberOwner
              const canRemove = (isOwner || isEditor) && !isSelf && !isMemberOwner
              return (
                <li
                  key={m.id}
                  className="grid grid-cols-[1fr_140px_60px] items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--canvas-dark-300)]"
                >
                  <div className="flex items-center gap-[11px] min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs overflow-hidden flex-shrink-0 font-comfortaa font-semibold"
                      style={{
                        background:
                          'oklch(from var(--brand) l c h / 0.14)',
                        color: 'var(--brand)',
                      }}
                    >
                      {m.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.user.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (m.user.name?.[0] ?? '?').toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-comfortaa font-semibold text-[14px] truncate"
                        style={{ color: 'var(--canvas-dark-ink-strong)' }}
                      >
                        @{m.user.name ?? m.user.email}
                      </p>
                      <p
                        className="font-mono text-[11px] tracking-wider truncate"
                        style={{ color: 'var(--canvas-dark-ink-muted)' }}
                      >
                        joined {formatJoinDate(m.joinedAt)}
                      </p>
                    </div>
                  </div>
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
                            padding: '4px 26px 4px 12px',
                            borderRadius: 'var(--r-pill)',
                            border:
                              '1px solid oklch(from var(--pill-accent) l c h / 0.3)',
                            background:
                              'oklch(from var(--pill-accent) l c h / 0.14)',
                            color: 'var(--pill-accent)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.06em',
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
                  <div className="flex justify-end">
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(m.userId)}
                        aria-label="Remove member"
                        style={{
                          color: 'var(--canvas-dark-ink-muted)',
                          borderRadius: 'var(--r-btn)',
                          background: 'transparent',
                        }}
                        className="p-1.5 transition-colors hover:bg-[var(--canvas-dark-100)] hover:text-[var(--canvas-dark-ink-strong)]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </HiveSectionDivider>
    </>
  )
}

// ── Invite friends panel ─────────────────────────────────────────────────────

const FRIEND_PAGE_SIZE = 5

function InviteFriendsPanel({
  hiveId,
  friends,
  memberUserIds,
}: {
  hiveId: string
  friends: FriendSummary[]
  memberUserIds: Set<string>
}) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(FRIEND_PAGE_SIZE)
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set())
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // When the user is actively searching, show all matches (search narrows the
  // list down enough on its own). When they're just browsing, show the N most
  // recently added friends and let them click "See more" to extend.
  const isSearching = query.trim().length > 0
  const recentFriends = useMemo(
    () =>
      [...friends].sort(
        (a, b) =>
          new Date(b.friendsSince).getTime() - new Date(a.friendsSince).getTime(),
      ),
    [friends],
  )
  const searchMatches = useMemo(() => {
    if (!isSearching) return [] as FriendSummary[]
    const q = query.trim().toLowerCase()
    return recentFriends.filter((f) => {
      const name = (f.displayName ?? '').toLowerCase()
      const handle = (f.username ?? '').toLowerCase()
      return name.includes(q) || handle.includes(q)
    })
  }, [recentFriends, query, isSearching])
  const visible = isSearching ? searchMatches : recentFriends.slice(0, visibleCount)
  const hasMore = !isSearching && visibleCount < recentFriends.length

  function handleInvite(friend: FriendSummary) {
    if (!friend.username) {
      toast.error('This friend has no username yet')
      return
    }
    setPendingUserId(friend.userId)
    startTransition(async () => {
      const result = await inviteMemberByUsernameAction(hiveId, friend.username!)
      setPendingUserId(null)
      if (result.success) {
        setInvitedUserIds((prev) => new Set(prev).add(friend.userId))
        toast.success(`Invite sent to @${friend.username}`)
      } else {
        toast.error(result.error || 'Could not send invite')
      }
    })
  }

  if (friends.length === 0) {
    return (
      <p className="text-[12.5px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
        You don&apos;t have any friends yet. Add friends from their profile pages, then invite them here.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search row */}
      <div
        className="inline-flex items-center gap-2 px-[14px]"
        style={{
          height: 38,
          borderRadius: 'var(--r-row)',
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
        }}
      >
        <Search size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search friends by name or @handle"
          style={{ color: 'var(--canvas-dark-ink)' }}
          className="flex-1 bg-transparent border-0 outline-none text-[13px] font-geist placeholder:text-[var(--canvas-dark-ink-muted)]"
        />
      </div>

      {/* Friends list */}
      {visible.length === 0 ? (
        <p className="text-[12.5px] py-3" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          No friends match that search.
        </p>
      ) : (
        <ul
          className="overflow-hidden divide-y divide-[var(--canvas-dark-300)]/40"
          style={{ borderRadius: 'var(--r-row)', border: 'var(--br-card)' }}
        >
          {visible.map((friend) => {
            const isMember = memberUserIds.has(friend.userId)
            const wasInvited = invitedUserIds.has(friend.userId)
            const isPending = pendingUserId === friend.userId
            const initial = (friend.displayName ?? friend.username ?? '?').charAt(0).toUpperCase()
            return (
              <li
                key={friend.userId}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--canvas-dark-300)]"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs overflow-hidden flex-shrink-0 font-comfortaa font-semibold"
                  style={{
                    background: 'oklch(from var(--brand) l c h / 0.14)',
                    color: 'var(--brand)',
                  }}
                >
                  {friend.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-comfortaa font-semibold text-[13.5px] truncate"
                    style={{ color: 'var(--canvas-dark-ink-strong)' }}
                  >
                    {friend.displayName ?? (friend.username ? `@${friend.username}` : 'Unknown')}
                  </p>
                  {friend.username && friend.displayName && (
                    <p
                      className="font-mono text-[11px] tracking-wider truncate"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      @{friend.username}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {isMember ? (
                    <HivePill token="--role-reader">In hive</HivePill>
                  ) : wasInvited ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider"
                      style={{
                        color: 'var(--canvas-dark-ink-muted)',
                        background: 'var(--canvas-dark-100)',
                        borderRadius: 'var(--r-pill)',
                      }}
                    >
                      <Check size={12} /> Invited
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInvite(friend)}
                      disabled={isPending}
                      style={{
                        background: 'var(--brand)',
                        color: 'var(--brand-ink)',
                        borderRadius: 'var(--r-pill)',
                        boxShadow: 'var(--sh-tile)',
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 font-geist font-semibold text-[12px] transition-transform hover:-translate-y-px hover:bg-[var(--brand-hover)] active:translate-y-0 active:bg-[var(--brand-active)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserPlus size={12} />
                      {isPending ? '…' : 'Invite'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() =>
            setVisibleCount((n) => Math.min(n + FRIEND_PAGE_SIZE, recentFriends.length))
          }
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            borderRadius: 'var(--r-row)',
            color: 'var(--canvas-dark-ink)',
          }}
          className="self-center mt-1 inline-flex items-center gap-1.5 px-4 py-2 font-geist text-[12.5px] font-medium transition-transform hover:-translate-y-px hover:text-[var(--canvas-dark-ink-strong)]"
        >
          See more friends
          <span
            className="font-mono text-[10.5px] tracking-wider"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            ({Math.min(FRIEND_PAGE_SIZE, recentFriends.length - visibleCount)} more)
          </span>
        </button>
      )}
    </div>
  )
}
