'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  UserPlus,
  Search,
  Copy,
  RotateCcw,
  Link2,
  Check,
  Send,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  generateInviteLinkAction,
  inviteMemberByUsernameAction,
} from '@/lib/actions/hive.actions'
import type { FriendSummary } from '@/lib/actions/friendships.actions'
import { FREE_HIVE_MEMBER_LIMIT } from '@/lib/premium'
import { UpgradeModal } from '@/components/upgrade/upgrade-modal'
import { toastNetworkError } from '@/lib/errors/notify'

const FRIEND_PAGE_SIZE = 5

type Props = {
  hiveId: string
  locale: string
  friends: FriendSummary[]
  memberUserIds: Set<string>
  memberCount: number
}

const inputStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  border: 0,
  borderRadius: 'var(--r-row)',
  padding: '11px 14px',
  fontFamily: 'var(--font-ui)',
  fontSize: '14px',
  color: 'var(--canvas-dark-ink-strong)',
  outline: 'none',
  width: '100%',
}

const tileButtonStyle: React.CSSProperties = {
  background:
    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  boxShadow: 'var(--sh-tile)',
  borderRadius: 'var(--r-row)',
  color: 'var(--canvas-dark-ink)',
  border: 'none',
  fontFamily: 'var(--font-ui)',
  fontWeight: 600,
  fontSize: '12.5px',
  height: '40px',
  padding: '0 14px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap',
  transition: 'background 0.12s, color 0.12s',
}

// Brand pill — flat, NO glow (uses --sh-tile, not --sh-brand).
const brandButtonStyle: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'var(--brand-ink)',
  borderRadius: 'var(--r-pill)',
  boxShadow: 'var(--sh-tile)',
  border: 'none',
  fontFamily: 'var(--font-ui)',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
}

export function InviteModal({
  hiveId,
  locale,
  friends,
  memberUserIds,
  memberCount,
}: Props) {
  const [open, setOpen] = useState(false)
  const [limitOpen, setLimitOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...brandButtonStyle, height: '36px', padding: '0 16px' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--brand-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--brand)'
        }}
      >
        <UserPlus size={14} strokeWidth={2.2} />
        Invite
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <p
              className="font-mono uppercase tracking-wider"
              style={{
                fontSize: '10px',
                letterSpacing: '0.16em',
                color: 'var(--canvas-dark-ink-muted)',
                marginBottom: '4px',
              }}
            >
              Grow your hive
            </p>
            <DialogTitle
              className="font-comfortaa font-bold"
              style={{
                fontSize: '22px',
                color: 'var(--brand)',
                letterSpacing: '-0.01em',
              }}
            >
              Invite members
            </DialogTitle>
            <DialogDescription>
              {memberCount} of {FREE_HIVE_MEMBER_LIMIT} members. Pick the easiest path.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <InviteLinkBlock hiveId={hiveId} locale={locale} />
            <OrDivider />
            <UsernameBlock hiveId={hiveId} onLimitReached={() => setLimitOpen(true)} />
            <FriendsBlock
              hiveId={hiveId}
              friends={friends}
              memberUserIds={memberUserIds}
              onLimitReached={() => setLimitOpen(true)}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeModal
        feature="hive-members"
        locale={locale}
        isAuthed
        open={limitOpen}
        onOpenChange={setLimitOpen}
      />
    </>
  )
}

// ─── Primary: invite link ───────────────────────────────────────────────────

function InviteLinkBlock({ hiveId, locale }: { hiveId: string; locale: string }) {
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await generateInviteLinkAction(hiveId)
      if (result.success) {
        setInviteLink(
          `${window.location.origin}/${locale}/hive/invite/${result.data.token}`,
        )
        toast.success('Invite link generated')
      } else {
        toast.error(result.error || 'Could not generate link')
      }
    } catch {
      toastNetworkError()
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <div
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        border: '1px solid oklch(from var(--brand) l c h / 0.18)',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
        padding: '18px',
      }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span
          aria-hidden
          className="inline-flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'oklch(from var(--brand) l c h / 0.16)',
            color: 'var(--brand)',
          }}
        >
          <Link2 size={14} strokeWidth={2.2} />
        </span>
        <h3
          className="font-comfortaa font-bold"
          style={{
            fontSize: '14px',
            color: 'var(--canvas-dark-ink-strong)',
            margin: 0,
          }}
        >
          Share an invite link
        </h3>
        <span
          className="ml-auto font-mono uppercase"
          style={{
            fontSize: '9.5px',
            letterSpacing: '0.14em',
            color: 'var(--brand)',
            background: 'oklch(from var(--brand) l c h / 0.14)',
            padding: '3px 8px',
            borderRadius: 'var(--r-pill)',
            fontWeight: 700,
          }}
        >
          Recommended
        </span>
      </div>
      <p
        className="mb-3.5"
        style={{
          fontSize: '12.5px',
          color: 'var(--canvas-dark-ink-muted)',
          margin: '0 0 14px',
          lineHeight: 1.5,
        }}
      >
        Anyone who opens the link can join. Easiest way to onboard a new collaborator.
      </p>

      {inviteLink ? (
        <div className="flex gap-2 items-stretch">
          <div
            className="flex-1 min-w-0 flex items-center px-3.5 font-mono"
            style={{
              height: 40,
              background: 'var(--canvas-dark-100)',
              boxShadow: 'var(--sh-inset)',
              borderRadius: 'var(--r-row)',
              color: 'var(--canvas-dark-ink)',
              fontSize: 12.5,
            }}
          >
            <span className="truncate whitespace-nowrap">{inviteLink}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            style={tileButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))'
              e.currentTarget.style.color = 'var(--canvas-dark-ink-strong)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
              e.currentTarget.style.color = 'var(--canvas-dark-ink)'
            }}
          >
            <Copy size={13} strokeWidth={2} />
            Copy
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={tileButtonStyle}
          >
            <RotateCcw size={13} strokeWidth={2} />
            {generating ? '…' : 'New'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          style={{ ...brandButtonStyle, height: 40, padding: '0 20px' }}
          onMouseEnter={(e) => {
            if (!generating) e.currentTarget.style.background = 'var(--brand-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--brand)'
          }}
        >
          <Link2 size={14} strokeWidth={2.2} />
          {generating ? 'Generating…' : 'Generate invite link'}
        </button>
      )}

      <p
        className="mt-3 font-mono uppercase"
        style={{
          fontSize: '10.5px',
          color: 'var(--canvas-dark-ink-faint)',
          letterSpacing: '0.06em',
          margin: '12px 0 0',
        }}
      >
        New joiners land as · Beta reader · Promote later from the member list
      </p>
    </div>
  )
}

// ─── OR divider ─────────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex-1 h-px"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      />
      <span
        className="font-mono uppercase"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.16em',
          color: 'var(--canvas-dark-ink-faint)',
        }}
      >
        Or
      </span>
      <span
        className="flex-1 h-px"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      />
    </div>
  )
}

// ─── Secondary: by username ─────────────────────────────────────────────────

function UsernameBlock({
  hiveId,
  onLimitReached,
}: {
  hiveId: string
  onLimitReached: () => void
}) {
  const [username, setUsername] = useState('')
  const [, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)

  const trimmed = username.trim().replace(/^@/, '')
  const canSend = trimmed.length > 0 && !submitting

  function handleSend() {
    if (!canSend) return
    setSubmitting(true)
    startTransition(async () => {
      try {
        const result = await inviteMemberByUsernameAction(hiveId, trimmed)
        if (result.success) {
          toast.success(`Invite sent to @${trimmed}`)
          setUsername('')
        } else if (result.error === 'FREE_LIMIT_REACHED') {
          onLimitReached()
        } else {
          toast.error(result.error || 'Could not send invite')
        }
      } catch {
        toastNetworkError()
      } finally {
        setSubmitting(false)
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h4
        className="font-comfortaa font-bold"
        style={{
          fontSize: '13px',
          color: 'var(--canvas-dark-ink-strong)',
          margin: 0,
        }}
      >
        Invite by username
      </h4>
      <p
        style={{
          fontSize: '12px',
          color: 'var(--canvas-dark-ink-muted)',
          margin: 0,
        }}
      >
        Send a direct invite to someone with a Beehive account.
      </p>
      <div className="flex gap-2 mt-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@username"
          style={inputStyle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSend) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            ...brandButtonStyle,
            height: 34,
            padding: '0 14px',
            fontSize: 12,
            opacity: canSend ? 1 : 0.5,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={(e) => {
            if (canSend) e.currentTarget.style.background = 'var(--brand-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--brand)'
          }}
        >
          <Send size={12} strokeWidth={2.2} />
          Send
        </button>
      </div>
    </div>
  )
}

// ─── Secondary: friends list ────────────────────────────────────────────────

function FriendsBlock({
  hiveId,
  friends,
  memberUserIds,
  onLimitReached,
}: {
  hiveId: string
  friends: FriendSummary[]
  memberUserIds: Set<string>
  onLimitReached: () => void
}) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(FRIEND_PAGE_SIZE)
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set())
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const isSearching = query.trim().length > 0

  // Friends who AREN'T already members of this hive, sorted recent-first.
  // Existing members are silently dropped — no point surfacing someone who's
  // already in the room.
  const recentFriends = useMemo(
    () =>
      [...friends]
        .filter((f) => !memberUserIds.has(f.userId))
        .sort(
          (a, b) =>
            new Date(b.friendsSince).getTime() - new Date(a.friendsSince).getTime(),
        ),
    [friends, memberUserIds],
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
      try {
        const result = await inviteMemberByUsernameAction(hiveId, friend.username!)
        if (result.success) {
          setInvitedUserIds((prev) => new Set(prev).add(friend.userId))
          toast.success(`Invite sent to @${friend.username}`)
        } else if (result.error === 'FREE_LIMIT_REACHED') {
          onLimitReached()
        } else {
          toast.error(result.error || 'Could not send invite')
        }
      } catch {
        toastNetworkError()
      } finally {
        setPendingUserId(null)
      }
    })
  }

  if (recentFriends.length === 0) {
    const allFriendsInHive = friends.length > 0
    return (
      <div className="flex flex-col gap-1.5">
        <h4
          className="font-comfortaa font-bold"
          style={{
            fontSize: '13px',
            color: 'var(--canvas-dark-ink-strong)',
            margin: 0,
          }}
        >
          Invite a friend
        </h4>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--canvas-dark-ink-muted)',
            margin: 0,
          }}
        >
          {allFriendsInHive
            ? 'All of your friends are already in this hive. 🎉'
            : "You don’t have any friends yet. Add friends from their profile pages, then come back to invite them here."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h4
          className="font-comfortaa font-bold"
          style={{
            fontSize: '13px',
            color: 'var(--canvas-dark-ink-strong)',
            margin: 0,
          }}
        >
          Invite a friend
        </h4>
        <div
          className="inline-flex items-center gap-2 px-3"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            borderRadius: 'var(--r-pill)',
            height: 30,
            width: 200,
          }}
        >
          <Search size={12} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends…"
            className="flex-1 bg-transparent border-0 outline-none text-[12px] placeholder:text-[var(--canvas-dark-ink-faint)]"
            style={{ color: 'var(--canvas-dark-ink-strong)' }}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p
          style={{
            fontSize: '12.5px',
            color: 'var(--canvas-dark-ink-muted)',
            padding: '12px 0',
          }}
        >
          No friends match that search.
        </p>
      ) : (
        <div
          className="flex flex-col"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            borderRadius: 'var(--r-row)',
            padding: 4,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {visible.map((friend) => {
            // Friends-in-hive are filtered upstream in `recentFriends`, so
            // every row here is invitable (pending / invited / not yet).
            const wasInvited = invitedUserIds.has(friend.userId)
            const isPending = pendingUserId === friend.userId
            const initial = (friend.displayName ?? friend.username ?? '?')
              .charAt(0)
              .toUpperCase()
            return (
              <div
                key={friend.userId}
                className="flex items-center gap-2.5 px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
                style={{ borderRadius: 'var(--r-btn)' }}
              >
                <div
                  className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 font-comfortaa font-semibold"
                  style={{
                    width: 30,
                    height: 30,
                    fontSize: 12,
                    background: 'oklch(from var(--brand) l c h / 0.18)',
                    color: 'var(--brand)',
                  }}
                >
                  {friend.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={friend.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initial
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-comfortaa font-semibold truncate"
                    style={{
                      fontSize: 13,
                      color: 'var(--canvas-dark-ink-strong)',
                    }}
                  >
                    {friend.displayName ??
                      (friend.username ? `@${friend.username}` : 'Unknown')}
                  </div>
                  {friend.username && friend.displayName && (
                    <div
                      className="font-mono truncate"
                      style={{
                        fontSize: 10.5,
                        letterSpacing: '0.06em',
                        color: 'var(--canvas-dark-ink-muted)',
                      }}
                    >
                      @{friend.username}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {wasInvited ? (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 font-mono uppercase"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.1em',
                        color: 'var(--status-success)',
                        background: 'oklch(from var(--status-success) l c h / 0.14)',
                        border:
                          '1px solid oklch(from var(--status-success) l c h / 0.3)',
                        borderRadius: 'var(--r-pill)',
                      }}
                    >
                      <Check size={11} strokeWidth={2.4} />
                      Invited
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInvite(friend)}
                      disabled={isPending}
                      style={{
                        ...tileButtonStyle,
                        height: 30,
                        padding: '0 12px',
                        fontSize: 11.5,
                      }}
                      onMouseEnter={(e) => {
                        if (isPending) return
                        e.currentTarget.style.background =
                          'linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))'
                        e.currentTarget.style.color = 'var(--canvas-dark-ink-strong)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                        e.currentTarget.style.color = 'var(--canvas-dark-ink)'
                      }}
                    >
                      <UserPlus size={11} strokeWidth={2.2} />
                      {isPending ? '…' : 'Invite'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() =>
            setVisibleCount((n) =>
              Math.min(n + FRIEND_PAGE_SIZE, recentFriends.length),
            )
          }
          className="self-center mt-1 px-3 py-1.5 font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--canvas-dark-ink-muted)',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--canvas-dark-ink-strong)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--canvas-dark-ink-muted)'
          }}
        >
          See more friends ({Math.min(FRIEND_PAGE_SIZE, recentFriends.length - visibleCount)})
        </button>
      )}
    </div>
  )
}
