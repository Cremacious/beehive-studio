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
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HiveSectionDivider } from '../../_components/hive-section-divider'
import { TopicPill } from './discussion-row'

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
    <>
      <HiveSectionDivider label="Original post" hideTopBorder>
        <PostBody
          post={post}
          isTopLevel
          viewerRole={viewerRole}
          viewerUserId={viewerUserId}
          locale={locale}
          hiveId={hiveId}
          onReplyClick={() => focusReplyWithMention(post.username)}
        />
      </HiveSectionDivider>

      <HiveSectionDivider
        label={`${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
      >
        {replies.length === 0 ? (
          <div
            style={{
              background: 'var(--canvas-dark-100)',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-inset)',
            }}
            className="px-3 py-6 text-center text-sm font-mono text-[var(--canvas-dark-ink-muted)] italic"
          >
            No replies yet — be the first to chime in.
          </div>
        ) : (
          <div className="flex flex-col">
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
      </HiveSectionDivider>

      <HiveSectionDivider label="Reply">
        <div className="flex gap-3">
          <Avatar size="md" username="you" />
          <div className="flex-1 min-w-0">
            <textarea
              ref={replyRef}
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="Add a reply…"
              rows={3}
              style={{
                background: 'var(--canvas-dark-100)',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink-strong)',
              }}
              className="w-full px-3.5 py-3 min-h-[100px] resize-y font-geist text-sm leading-relaxed focus:outline-none placeholder:text-[var(--canvas-dark-ink-muted)]"
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
                onMouseDown={(e) => {
                  if (e.currentTarget.disabled) return
                  e.currentTarget.style.background = 'var(--brand-active)'
                  e.currentTarget.style.transform = 'none'
                }}
                onMouseUp={(e) => {
                  if (e.currentTarget.disabled) return
                  e.currentTarget.style.background = 'var(--brand-hover)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                className="font-geist font-semibold text-[13px] px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <Reply size={12} />
                {replying ? 'Posting…' : 'Post Reply'}
              </button>
            </div>
          </div>
        </div>
      </HiveSectionDivider>
    </>
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
  onReplyClick,
}: {
  post: DiscussionPostRow
  isTopLevel: boolean
  viewerRole: HiveRole
  viewerUserId: string
  locale: string
  hiveId: string
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

  // Top-level posts use the .post shape (bare flex, no chrome).
  // Replies use .reply-row shape (hairline border-top between siblings).
  const rootClass = isTopLevel
    ? 'flex gap-4'
    : 'flex gap-3 py-4 first:pt-0 first:border-t-0 border-t border-[var(--canvas-dark-300)]/40'

  return (
    <article className={rootClass}>
      <Avatar
        size={isTopLevel ? 'lg' : 'md'}
        username={post.username}
        avatarUrl={post.avatarUrl}
      />
      <div className="flex-1 min-w-0">
        <header className="flex items-center gap-2.5 flex-wrap mb-2">
          {post.username ? (
            <span
              className={`font-comfortaa font-bold text-[var(--canvas-dark-ink-strong)] ${
                isTopLevel ? 'text-[15px]' : 'text-sm'
              }`}
            >
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
          {isTopLevel && post.topic && (
            <span className="ml-auto">
              <TopicPill topic={post.topic} />
            </span>
          )}
          {!isTopLevel && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={onReplyClick}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] px-2 py-1 rounded transition-colors"
              >
                <Reply size={11} />
                Reply
              </button>
              {canEdit && <PostKebab onEdit={() => { setDraft(post.body); setEditing(true) }} onDelete={() => setConfirmDelete(true)} />}
            </div>
          )}
          {isTopLevel && canEdit && (
            <PostKebab onEdit={() => { setDraft(post.body); setEditing(true) }} onDelete={() => setConfirmDelete(true)} />
          )}
        </header>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.max(4, Math.min(draft.split('\n').length + 1, 16))}
              autoFocus
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
          <p
            className={`m-0 whitespace-pre-line text-[var(--canvas-dark-ink)] ${
              isTopLevel ? 'text-[14.5px] leading-[1.7]' : 'text-sm leading-[1.6]'
            }`}
          >
            {post.body}
          </p>
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
