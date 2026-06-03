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

function renderBody(body: string) {
  return body.split('\n').map((line, i) => (
    <p
      key={i}
      className="font-prose text-sm leading-relaxed text-[var(--canvas-dark-ink)] whitespace-pre-wrap"
    >
      {line || ' '}
    </p>
  ))
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
      </HiveSectionDivider>

      <HiveSectionDivider label="Reply">
        <textarea
          ref={replyRef}
          value={replyDraft}
          onChange={(e) => setReplyDraft(e.target.value)}
          placeholder="Add to the conversation…"
          rows={3}
          style={{
            background: 'var(--canvas-dark-100)',
            borderRadius: 'var(--r-row)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink)',
          }}
          className="w-full px-3 py-2 min-h-[90px] resize-y font-geist text-sm focus:outline-none placeholder:text-[var(--canvas-dark-ink-muted)]"
        />
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={submitReply}
            disabled={!replyDraft.trim() || replying}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              borderRadius: 'var(--r-pill)',
              boxShadow: 'var(--sh-tile)',
            }}
            className="font-geist font-semibold text-[13px] px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Reply size={12} />
            {replying ? 'Posting…' : 'Post Reply'}
          </button>
        </div>
      </HiveSectionDivider>
    </>
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

  return (
    <article
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
      }}
      className="p-4"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-10 h-10 rounded-full text-[var(--canvas-dark-ink-muted)] bg-[var(--canvas-dark-100)] text-sm font-semibold shrink-0"
            style={{ boxShadow: 'var(--sh-inset)' }}
          >
            {post.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              post.username?.[0]?.toUpperCase() ?? '?'
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {post.username ? (
                <span className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)] truncate">
                  @{post.username}
                </span>
              ) : (
                <span className="text-sm font-semibold text-[var(--canvas-dark-ink-muted)] italic">
                  Unknown
                </span>
              )}
              {isTopLevel && post.topic && <TopicPill topic={post.topic} />}
            </div>
            <div className="text-[11px] font-mono text-[var(--canvas-dark-ink-muted)] mt-0.5">
              {relTime(post.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isTopLevel && (
            <button
              type="button"
              onClick={onReplyClick}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] px-2 py-1 rounded"
            >
              <Reply size={11} />
              Reply
            </button>
          )}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Post actions"
                  className="p-1 rounded hover:bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink-muted)]"
                >
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setDraft(post.body)
                    setEditing(true)
                  }}
                >
                  <Pencil size={12} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={(e) => {
                    e.preventDefault()
                    setConfirmDelete(true)
                  }}
                >
                  <Trash2 size={12} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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
        <div className="space-y-1">{renderBody(post.body)}</div>
      )}

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
