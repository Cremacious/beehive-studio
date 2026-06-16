'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Trash2, Reply } from 'lucide-react'
import { toast } from 'sonner'
import type { DiscussionPostRow } from '@/lib/actions/hive-discussions.actions'
import {
  replyToDiscussionPostAction,
  editDiscussionPostAction,
  deleteDiscussionPostAction,
} from '@/lib/actions/hive-discussions.actions'
import { canEditDiscussionPost, type HiveRole } from '@/lib/hive/permissions'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TopicPill } from './discussion-row'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'

function relTime(d: Date | string): string {
  const date = new Date(d)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Deterministic per-username avatar gradient (mimics mockup .av-* classes).
const AV_GRADIENTS = [
  'linear-gradient(150deg, oklch(0.6 0.13 250), oklch(0.46 0.1 280))', // blue
  'linear-gradient(150deg, oklch(0.62 0.13 20), oklch(0.48 0.1 12))', // rose
  'linear-gradient(150deg, oklch(0.6 0.12 155), oklch(0.46 0.1 165))', // mint
  'linear-gradient(150deg, oklch(0.6 0.12 290), oklch(0.46 0.1 300))', // violet
  'linear-gradient(150deg, oklch(0.7 0.13 70), oklch(0.55 0.12 55))', // amber
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

type Props = {
  post: DiscussionPostRow
  replies: DiscussionPostRow[]
  hiveId: string
  locale: string
  viewerRole: HiveRole
  viewerUserId: string
}

export function DiscussionThread({
  post,
  replies,
  hiveId,
  locale,
  viewerRole,
  viewerUserId,
}: Props) {
  const router = useRouter()
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replying, setReplying] = useState(false)

  function focusReplyWithMention(username: string | null) {
    setReplyDraft((prev) => {
      const mention = username ? `@${username} ` : ''
      if (prev.startsWith(mention)) return prev
      return mention + prev
    })
    requestAnimationFrame(() => {
      replyRef.current?.focus()
      const el = replyRef.current
      if (el) {
        el.setSelectionRange(el.value.length, el.value.length)
      }
    })
  }

  async function submitReply() {
    const body = replyDraft.trim()
    if (!body || replying) return
    setReplying(true)
    try {
      const r = await replyToDiscussionPostAction({ parentId: post.id, body })
      if (!r.success) {
        toast.error(r.error)
        return
      }
      toast.success('Reply posted')
      setReplyDraft('')
      router.refresh()
    } finally {
      setReplying(false)
    }
  }

  const replyCount = replies.length

  return (
    <div className="px-6 pb-6">
      {/* OP card — Facebook-style. No left-side identity; meta cluster
          sits in top-right (timestamp + topic pill + kebab). Bottom strip
          shows reply count + a Reply CTA that focuses the composer. */}
      <PostBody
        post={post}
        isTopLevel
        viewerRole={viewerRole}
        viewerUserId={viewerUserId}
        locale={locale}
        hiveId={hiveId}
        replyCount={replyCount}
        onReplyClick={() => focusReplyWithMention(post.username)}
      />

      {/* Indented reply thread. Layout split so the vertical thread line
          stops at the composer's connector elbow instead of dangling past
          the textarea + post button. The line runs through the replies
          block (borderLeft) + extends as a short absolute "stub" into the
          composer up to the elbow position, then ends. */}
      <div className="mt-4 ml-5">
        {/* Replies block — thread line runs full height of this section. */}
        <div
          className="relative"
          style={{
            paddingLeft: 24,
            borderLeft: '2px solid oklch(from var(--canvas-dark-ink) l c h / 0.10)',
          }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-[0.14em] mb-3"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {replyCount} {replyCount === 1 ? 'REPLY' : 'REPLIES'}
          </div>

          {replies.length === 0 ? (
            <div
              style={{
                background: 'var(--canvas-dark-100)',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink-muted)',
              }}
              className="px-3 py-5 text-center text-[13px] font-geist italic"
            >
              No replies yet. Be the first to chime in.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {replies.map((reply) => (
                <PostBody
                  key={reply.id}
                  post={reply}
                  isTopLevel={false}
                  viewerRole={viewerRole}
                  viewerUserId={viewerUserId}
                  locale={locale}
                  hiveId={hiveId}
                  onReplyClick={() => focusReplyWithMention(reply.username)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Composer block — thread line continues as a short absolute stub
            from the gap above down to the elbow (44px total: 20px of mt-5
            gap + 24px to the elbow). Below the elbow there's NO line — so
            it doesn't dangle past the textarea. */}
        <div className="mt-5 relative" style={{ paddingLeft: 24 }}>
          <span
            aria-hidden
            className="absolute"
            style={{
              left: 0, top: -20,
              width: 2, height: 44,
              background: 'oklch(from var(--canvas-dark-ink) l c h / 0.10)',
            }}
          />
          <span
            aria-hidden
            className="absolute"
            style={{
              left: 0, top: 24,
              width: 16, height: 2,
              background: 'oklch(from var(--canvas-dark-ink) l c h / 0.10)',
              borderRadius: 1,
            }}
          />
          <div className="flex gap-3">
            <Avatar size="md" username="you" />
            <div className="flex-1 min-w-0">
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
                }}
                className="w-full px-3.5 py-3 min-h-[88px] resize-y font-geist text-sm leading-relaxed focus:outline-none placeholder:text-[var(--canvas-dark-ink-muted)] border-0"
              />
              <div className="flex justify-end mt-2.5">
                <button
                  type="button"
                  onClick={submitReply}
                  disabled={!replyDraft.trim() || replying}
                  style={{
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    borderRadius: 'var(--r-pill)',
                    boxShadow: 'var(--sh-tile)',
                    transition: 'background .14s, transform .1s',
                  }}
                  onMouseEnter={(e) => {
                    if (e.currentTarget.disabled) return
                    e.currentTarget.style.background = 'var(--brand-hover)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--brand)'
                    e.currentTarget.style.transform = 'none'
                  }}
                  className="font-geist font-semibold text-[13px] px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  <Reply size={12} />
                  {replying ? 'Posting…' : 'Post Reply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Avatar({
  size,
  username,
  avatarUrl,
}: {
  size: 'md' | 'lg'
  username: string | null
  avatarUrl?: string | null
}) {
  const dims = size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-xs'
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`${dims} rounded-full object-cover shrink-0`}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={`${dims} rounded-full inline-flex items-center justify-center font-comfortaa font-bold shrink-0 text-white`}
      style={{ background: gradientFor(username) }}
    >
      {initials(username)}
    </span>
  )
}

function PostBody({
  post,
  isTopLevel,
  viewerRole,
  viewerUserId,
  locale,
  hiveId,
  replyCount,
  onReplyClick,
}: {
  post: DiscussionPostRow
  isTopLevel: boolean
  viewerRole: HiveRole
  viewerUserId: string
  locale: string
  hiveId: string
  /** OP only: drives the "N replies" count in the bottom action bar. */
  replyCount?: number
  onReplyClick: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canEdit = canEditDiscussionPost(
    { authorId: post.authorId },
    viewerRole,
    viewerUserId,
  )

  async function saveEdit() {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true)
    try {
      const r = await editDiscussionPostAction({ postId: post.id, body })
      if (!r.success) {
        toast.error(r.error)
        return
      }
      toast.success('Updated')
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeletePost() {
    const r = await deleteDiscussionPostAction(post.id)
    if (!r.success) {
      toast.error(r.error)
      return
    }
    toast.success('Deleted')
    if (isTopLevel) {
      router.push(`/${locale}/hive/${hiveId}/discussions`)
    } else {
      router.refresh()
    }
  }

  // Each post (OP + reply) is its own forum-style card with tile chrome.
  // The OP is rendered slightly bigger (avatar + body type scale).
  const cardStyle: React.CSSProperties = {
    background:
      'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
  }

  return (
    <article
      style={cardStyle}
      className={`relative flex gap-4 px-5 py-4`}
    >
      {/* Horizontal connector elbow from the vertical thread line into the
          reply card. Only renders for replies — OP sits above the line. */}
      {!isTopLevel && (
        <span
          aria-hidden
          className="absolute"
          style={{
            left: -24, top: 24,
            width: 22, height: 2,
            background: 'oklch(from var(--canvas-dark-ink) l c h / 0.10)',
            borderRadius: 1,
          }}
        />
      )}
      <Avatar
        size={isTopLevel ? 'lg' : 'md'}
        username={post.username}
        avatarUrl={post.avatarUrl}
      />
      <div className="flex-1 min-w-0">
        <header className="flex items-center gap-2.5 flex-wrap mb-2">
          {/* Author identity row only renders for replies — the OP author is
              already shown in the page subtitle ("Started by @handle"), so
              the OP card just carries the right-side meta cluster. */}
          {!isTopLevel && (
            <>
              {post.username ? (
                <span className="font-comfortaa font-bold text-sm text-[var(--canvas-dark-ink-strong)]">
                  @{post.username}
                </span>
              ) : (
                <span className="text-sm font-semibold text-[var(--canvas-dark-ink-muted)] italic">
                  Unknown
                </span>
              )}
              <span
                className="text-[11px] font-mono text-[var(--canvas-dark-ink-muted)]"
                style={{ letterSpacing: '0.04em' }}
              >
                {relTime(post.createdAt)}
              </span>
            </>
          )}

          {/* Right cluster. OP: timestamp + topic pill + kebab. Replies:
              reply button + kebab. */}
          {isTopLevel ? (
            <div className="ml-auto flex items-center gap-2.5 flex-wrap">
              <span
                className="text-[11px] font-mono text-[var(--canvas-dark-ink-muted)]"
                style={{ letterSpacing: '0.04em' }}
              >
                {relTime(post.createdAt)}
              </span>
              {post.topic && <TopicPill topic={post.topic} />}
              {canEdit && (
                <PostKebab
                  onEdit={() => { setDraft(post.body); setEditing(true) }}
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={onReplyClick}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] px-2 py-1 rounded transition-colors"
              >
                <Reply size={11} />
                Reply
              </button>
              {canEdit && (
                <PostKebab
                  onEdit={() => { setDraft(post.body); setEditing(true) }}
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </div>
          )}
        </header>

        {editing ? (
          <div className="space-y-2">
            <MentionableTextarea
              value={draft}
              onChange={setDraft}
              rows={Math.max(5, Math.min(draft.split('\n').length + 2, 16))}
              autoFocus
              style={{
                background: 'var(--canvas-dark-100)',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink-strong)',
              }}
              className="w-full px-3.5 py-3 min-h-[120px] resize-y font-geist text-sm leading-relaxed focus:outline-none placeholder:text-[var(--canvas-dark-ink-muted)] border-0"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setDraft(post.body)
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={saving || !draft.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          (() => {
            // OP card: strip the first line — it's the derived discussion
            // title, already shown as the brand-yellow h1 in the page header.
            // Replies show body verbatim. If a top-level post is a single
            // line (the title IS the whole body), the card body is hidden.
            const displayBody = isTopLevel
              ? post.body.split('\n').slice(1).join('\n').trim()
              : post.body
            if (!displayBody) return null
            return (
              <p
                className={`m-0 whitespace-pre-line text-[var(--canvas-dark-ink)] ${
                  isTopLevel ? 'text-[15px] leading-[1.7]' : 'text-[14px] leading-[1.6]'
                }`}
              >
                <RenderMentionsInText text={displayBody} />
              </p>
            )
          })()
        )}

        {/* OP action bar — Facebook-style. Reply CTA (focuses the composer)
            on the left, "N replies" count on the right. Only renders on the
            OP card; replies have their own inline Reply button in the header
            cluster. */}
        {isTopLevel && !editing && (
          <div
            className="mt-4 pt-3 flex items-center gap-3"
            style={{ borderTop: '1px solid oklch(from var(--canvas-dark-ink) l c h / 0.06)' }}
          >
            <button
              type="button"
              onClick={onReplyClick}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-geist text-[13px] font-medium text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)] hover:bg-[oklch(from_var(--canvas-dark-ink)_l_c_h_/_0.04)] transition-colors"
            >
              <Reply size={14} />
              Reply
            </button>
            <span
              className="ml-auto font-mono text-[11px]"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {replyCount ?? 0} {(replyCount ?? 0) === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        variant="destructive"
        title={isTopLevel ? 'Delete this post?' : 'Delete this reply?'}
        description={
          isTopLevel
            ? 'Replies will also be deleted. This cannot be undone.'
            : 'This cannot be undone.'
        }
        confirmLabel="Delete"
        onConfirm={confirmDeletePost}
      />
    </article>
  )
}

function PostKebab({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Post actions"
          className="p-1 rounded hover:bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink-muted)] transition-colors"
        >
          <MoreVertical size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            onEdit()
          }}
        >
          <Pencil size={12} className="mr-2" />
          Edit
        </DropdownMenuItem>
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
