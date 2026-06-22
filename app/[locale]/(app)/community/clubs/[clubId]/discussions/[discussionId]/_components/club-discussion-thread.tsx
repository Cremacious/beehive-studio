'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreVertical, Trash2, Reply, Heart, Pin as PinIcon, PinOff } from 'lucide-react'
import {
  replyToClubDiscussionAction,
  deleteClubDiscussionReplyAction,
  deleteClubDiscussionAction,
  toggleClubDiscussionLikeAction,
  toggleClubReplyLikeAction,
  pinClubDiscussionAction,
  type ClubDiscussionRow,
  type ClubDiscussionReply,
} from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'

function relTime(d: Date | string): string {
  const date = new Date(d)
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d2 = Math.floor(h / 24)
  if (d2 < 7) return `${d2}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const AV_GRADIENTS = [
  'linear-gradient(150deg, oklch(0.6 0.13 250), oklch(0.46 0.1 280))',
  'linear-gradient(150deg, oklch(0.62 0.13 20), oklch(0.48 0.1 12))',
  'linear-gradient(150deg, oklch(0.6 0.12 155), oklch(0.46 0.1 165))',
  'linear-gradient(150deg, oklch(0.6 0.12 290), oklch(0.46 0.1 300))',
  'linear-gradient(150deg, oklch(0.7 0.13 70), oklch(0.55 0.12 55))',
]
function gradientFor(username: string | null): string {
  if (!username) return AV_GRADIENTS[0]
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) | 0
  return AV_GRADIENTS[Math.abs(hash) % AV_GRADIENTS.length]
}
function initials(username: string | null): string {
  if (!username) return '?'
  return username.slice(0, 2).toUpperCase()
}

const THREAD = 'oklch(from var(--canvas-dark-ink) l c h / 0.10)'

function Avatar({
  size,
  username,
  avatarUrl,
}: {
  size: 'md' | 'lg'
  username: string | null
  avatarUrl?: string | null
}) {
  const dim = size === 'lg' ? 48 : 36
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        style={{
          width: dim,
          height: dim,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <span
      aria-hidden
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: size === 'lg' ? 14 : 12,
        color: 'white',
        background: gradientFor(username),
      }}
    >
      {initials(username)}
    </span>
  )
}

function PostKebab({
  onDelete,
}: {
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Post actions"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--canvas-dark-ink-muted)',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <MoreVertical size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive"
          onSelect={(e) => {
            e.preventDefault()
            onDelete()
          }}
        >
          <Trash2 size={12} className="mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LikePill({
  liked,
  count,
  onClick,
  pending,
}: {
  liked: boolean
  count: number
  onClick: () => void
  pending: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'transparent',
        border: liked
          ? '1px solid rgba(255,195,0,0.45)'
          : '1px dashed rgba(255,255,255,0.20)',
        color: liked ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
        cursor: pending ? 'wait' : 'pointer',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        opacity: pending ? 0.6 : 1,
        transition: 'all 0.15s',
      }}
    >
      <Heart
        aria-hidden="true"
        size={11}
        style={{ fill: liked ? 'var(--brand)' : 'none' }}
      />
      {count}
    </button>
  )
}

type Props = {
  discussion: ClubDiscussionRow
  replies: ClubDiscussionReply[]
  clubId: string
  locale: string
  viewerRole: BookClubMemberRole | null
  viewerUserId: string | null
}

export function ClubDiscussionThread({
  discussion,
  replies,
  clubId,
  locale,
  viewerRole,
  viewerUserId,
}: Props) {
  void locale
  const router = useRouter()
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replying, startReply] = useTransition()

  // Optimistic like state for OP
  const [postLiked, setPostLiked] = useState(discussion.viewerLiked)
  const [postLikeCount, setPostLikeCount] = useState(discussion.likeCount)
  const [postLikePending, startPostLike] = useTransition()

  // Pin state (mod/owner only)
  const [pinned, setPinned] = useState(discussion.isPinned)
  const [pinPending, startPin] = useTransition()

  // OP delete confirm
  const [confirmDeletePost, setConfirmDeletePost] = useState(false)

  const isMember = viewerRole !== null
  const isModOrOwner = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
  const canDeletePost = isModOrOwner || viewerUserId === discussion.authorId

  function focusComposerWithMention(username: string | null) {
    const mention = username ? `@${username} ` : ''
    setReplyDraft((prev) => {
      if (mention && prev.startsWith(mention)) return prev
      return mention + prev
    })
    requestAnimationFrame(() => {
      const el = replyRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      }
    })
  }

  function submitReply() {
    const body = replyDraft.trim()
    if (!body || replying) return
    startReply(async () => {
      const r = await replyToClubDiscussionAction({
        discussionId: discussion.id,
        content: body,
      })
      if (!r.success) {
        toast.error('Could not post reply')
        return
      }
      toast.success('Reply posted')
      setReplyDraft('')
      router.refresh()
    })
  }

  function togglePostLike() {
    const next = !postLiked
    setPostLiked(next)
    setPostLikeCount((c) => c + (next ? 1 : -1))
    startPostLike(async () => {
      const r = await toggleClubDiscussionLikeAction({ discussionId: discussion.id })
      if (!r.success) {
        setPostLiked(!next)
        setPostLikeCount((c) => c + (next ? -1 : 1))
        toast.error('Could not update like')
      }
    })
  }

  function togglePin() {
    if (!isModOrOwner) return
    const next = !pinned
    setPinned(next)
    startPin(async () => {
      const r = await pinClubDiscussionAction({
        discussionId: discussion.id,
        pin: next,
      })
      if (!r.success) {
        setPinned(!next)
        toast.error('Could not update pin')
        return
      }
      toast.success(next ? 'Pinned' : 'Unpinned')
      router.refresh()
    })
  }

  async function doDeletePost() {
    const r = await deleteClubDiscussionAction(discussion.id)
    if (!r.success) {
      toast.error('Could not delete')
      return
    }
    toast.success('Discussion deleted')
    router.push(`/${locale}/community/clubs/${clubId}/discussions`)
  }

  const replyCount = replies.length

  return (
    <div
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        padding: '20px 22px',
      }}
    >
      {/* OP card (tile chrome — sits inside the outer panel) */}
      <article
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-row)',
          boxShadow: 'var(--sh-tile)',
          padding: '20px 22px',
          display: 'flex',
          gap: 14,
        }}
      >
        <Avatar size="lg" username={discussion.author.username} avatarUrl={discussion.author.avatarUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 14,
                color: 'var(--canvas-dark-ink-strong)',
              }}
            >
              @{discussion.author.username ?? 'unknown'}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--canvas-dark-ink-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {relTime(discussion.createdAt)}
            </span>
            <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {pinned && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--brand)',
                  }}
                >
                  <PinIcon size={10} /> Pinned
                </span>
              )}
              {isModOrOwner && (
                <button
                  type="button"
                  onClick={togglePin}
                  disabled={pinPending}
                  aria-label={pinned ? 'Unpin' : 'Pin'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    color: 'var(--canvas-dark-ink-muted)',
                  }}
                >
                  {pinned ? <PinOff size={14} /> : <PinIcon size={14} />}
                </button>
              )}
              {canDeletePost && (
                <PostKebab onDelete={() => setConfirmDeletePost(true)} />
              )}
            </div>
          </header>

          <p
            style={{
              fontFamily: 'var(--font-prose)',
              fontSize: 15,
              lineHeight: 1.7,
              color: 'var(--canvas-dark-ink)',
              margin: '6px 0 0',
              whiteSpace: 'pre-wrap',
            }}
          >
            <RenderMentionsInText text={discussion.content} />
          </p>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderTopWidth: 1,
              borderTopStyle: 'solid',
              borderTopColor: 'oklch(from var(--canvas-dark-ink) l c h / 0.06)',
            }}
          >
            <LikePill
              liked={postLiked}
              count={postLikeCount}
              onClick={togglePostLike}
              pending={postLikePending}
            />
            {isMember && (
              <button
                type="button"
                onClick={() => focusComposerWithMention(discussion.author.username)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--canvas-dark-ink-muted)',
                  borderRadius: 6,
                }}
              >
                <Reply size={12} /> Reply
              </button>
            )}
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--canvas-dark-ink-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </div>
      </article>

      {/* Indented thread */}
      <div style={{ marginTop: 16, marginLeft: 22 }}>
        <div
          style={{
            position: 'relative',
            paddingLeft: 24,
            borderLeft: `2px solid ${THREAD}`,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              marginBottom: 12,
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </div>

          {replies.length === 0 ? (
            <div
              style={{
                background: 'var(--canvas-dark-100)',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink-muted)',
                padding: '18px 14px',
                textAlign: 'center',
                fontSize: 13,
                fontStyle: 'italic',
              }}
            >
              No replies yet. Be the first to chime in.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {replies.map((r) => (
                <ReplyCard
                  key={r.id}
                  reply={r}
                  viewerRole={viewerRole}
                  viewerUserId={viewerUserId}
                  onReplyClick={() => focusComposerWithMention(r.author.username)}
                  onAfterDelete={() => router.refresh()}
                />
              ))}
            </div>
          )}
        </div>

        {/* Composer (members only) */}
        {isMember && (
          <div
            style={{
              marginTop: 20,
              paddingLeft: 24,
              position: 'relative',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: -20,
                width: 2,
                height: 44,
                background: THREAD,
              }}
            />
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 24,
                width: 16,
                height: 2,
                background: THREAD,
                borderRadius: 1,
              }}
            />
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Avatar size="md" username={viewerUserId} avatarUrl={null} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <MentionableTextarea
                  ref={replyRef}
                  value={replyDraft}
                  onChange={setReplyDraft}
                  placeholder="Write a reply…"
                  rows={3}
                  style={{
                    background: 'var(--canvas-dark-100)',
                    borderRadius: 'var(--r-row)',
                    boxShadow: 'var(--sh-inset)',
                    color: 'var(--canvas-dark-ink-strong)',
                    border: 'none',
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 14,
                    lineHeight: 1.5,
                    resize: 'vertical',
                    minHeight: 84,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={submitReply}
                    disabled={!replyDraft.trim() || replying}
                    style={{
                      background: 'var(--brand)',
                      color: 'var(--brand-ink)',
                      border: 'none',
                      borderRadius: 999,
                      padding: '7px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: replying || !replyDraft.trim() ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: replying || !replyDraft.trim() ? 0.55 : 1,
                    }}
                  >
                    <Reply size={12} />
                    {replying ? 'Posting…' : 'Post Reply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeletePost}
        onOpenChange={setConfirmDeletePost}
        variant="destructive"
        title="Delete this discussion?"
        description="Replies will also be deleted. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={doDeletePost}
      />
    </div>
  )
}

function ReplyCard({
  reply,
  viewerRole,
  viewerUserId,
  onReplyClick,
  onAfterDelete,
}: {
  reply: ClubDiscussionReply
  viewerRole: BookClubMemberRole | null
  viewerUserId: string | null
  onReplyClick: () => void
  onAfterDelete: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [liked, setLiked] = useState(reply.viewerLiked)
  const [count, setCount] = useState(reply.likeCount)
  const [likePending, startLike] = useTransition()

  const isMember = viewerRole !== null
  const canDelete =
    viewerUserId === reply.authorId ||
    viewerRole === 'OWNER' ||
    viewerRole === 'MODERATOR'

  function toggleLike() {
    const next = !liked
    setLiked(next)
    setCount((c) => c + (next ? 1 : -1))
    startLike(async () => {
      const r = await toggleClubReplyLikeAction({ replyId: reply.id })
      if (!r.success) {
        setLiked(!next)
        setCount((c) => c + (next ? -1 : 1))
        toast.error('Could not update like')
      }
    })
  }

  async function doDelete() {
    const r = await deleteClubDiscussionReplyAction(reply.id)
    if (!r.success) {
      toast.error('Could not delete')
      return
    }
    toast.success('Reply deleted')
    onAfterDelete()
  }

  return (
    <article
      style={{
        position: 'relative',
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: -24,
          top: 24,
          width: 22,
          height: 2,
          background: THREAD,
          borderRadius: 1,
        }}
      />
      <Avatar size="md" username={reply.author.username} avatarUrl={reply.author.avatarUrl} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13,
              color: 'var(--canvas-dark-ink-strong)',
            }}
          >
            @{reply.author.username ?? 'unknown'}
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--canvas-dark-ink-muted)',
              letterSpacing: '0.04em',
            }}
          >
            {relTime(reply.createdAt)}
          </span>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {isMember && (
              <button
                type="button"
                onClick={onReplyClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--canvas-dark-ink-muted)',
                  borderRadius: 4,
                }}
              >
                <Reply size={11} /> Reply
              </button>
            )}
            {canDelete && <PostKebab onDelete={() => setConfirmDel(true)} />}
          </div>
        </header>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--canvas-dark-ink)',
            whiteSpace: 'pre-wrap',
          }}
        >
          <RenderMentionsInText text={reply.content} />
        </p>
        <div style={{ marginTop: 8 }}>
          <LikePill liked={liked} count={count} onClick={toggleLike} pending={likePending} />
        </div>
      </div>
      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        variant="destructive"
        title="Delete this reply?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={doDelete}
      />
    </article>
  )
}
