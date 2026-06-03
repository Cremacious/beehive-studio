'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MoreVertical, Pencil, Trash2, Reply } from 'lucide-react'
import { toast } from 'sonner'
import type {
  DiscussionPostRow,
} from '@/lib/actions/hive-discussions.actions'
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

  const totalPosts = 1 + replies.length

  return (
    <>
      <Link
        href={`/${locale}/hive/${hiveId}/discussions`}
        className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} />
        Back to discussions
      </Link>

      {/* Thread header banner */}
      <div
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="px-6 py-5 mb-4"
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {post.topic && <TopicPill topic={post.topic} />}
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
            Thread · {totalPosts} {totalPosts === 1 ? 'post' : 'posts'}
          </span>
        </div>
        <h1
          style={{ color: 'var(--brand)' }}
          className="font-comfortaa font-bold text-2xl leading-tight"
        >
          {(post.body.split('\n')[0] || 'Discussion').slice(0, 80)}
        </h1>
        <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-2">
          started by{' '}
          {post.username ? (
            <span className="text-[var(--canvas-dark-ink)]">@{post.username}</span>
          ) : (
            'unknown'
          )}{' '}
          · {relTime(post.createdAt)}
        </p>
      </div>

      {/* OP + replies as numbered posts */}
      <div className="space-y-3">
        <PostCard
          post={post}
          postNumber={1}
          isTopLevel
          viewerRole={viewerRole}
          viewerUserId={viewerUserId}
          locale={locale}
          hiveId={hiveId}
          onReplyClick={() => focusReplyWithMention(post.username)}
        />
        {replies.map((reply, i) => (
          <PostCard
            key={reply.id}
            post={reply}
            postNumber={i + 2}
            isTopLevel={false}
            viewerRole={viewerRole}
            viewerUserId={viewerUserId}
            locale={locale}
            hiveId={hiveId}
            onReplyClick={() => focusReplyWithMention(reply.username)}
          />
        ))}
        {replies.length === 0 && (
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
        )}
      </div>

      {/* Quick reply composer */}
      <div
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="mt-6 p-5"
      >
        <h2 className="font-comfortaa font-bold text-sm uppercase tracking-wide text-[var(--canvas-dark-ink-muted)] mb-3 inline-flex items-center gap-2">
          <Reply size={12} />
          Quick reply
        </h2>
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
            border: 'var(--br-card)',
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
              color: 'var(--brand-ink, oklch(0.18 0.02 60))',
              borderRadius: 'var(--r-btn)',
              boxShadow: 'var(--sh-tile)',
            }}
            className="font-geist font-semibold text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {replying ? 'Posting…' : 'Post Reply'}
          </button>
        </div>
      </div>
    </>
  )
}

function PostCard({
  post,
  postNumber,
  isTopLevel,
  viewerRole,
  viewerUserId,
  locale,
  hiveId,
  onReplyClick,
}: {
  post: DiscussionPostRow
  postNumber: number
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
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
        borderLeft: isTopLevel
          ? '3px solid var(--brand)'
          : '3px solid var(--canvas-dark-300)',
      }}
      className="grid gap-0"
    >
      <div
        className="grid items-stretch"
        style={{ gridTemplateColumns: '180px 1fr' }}
      >
        {/* Author column (left rail) */}
        <div
          className="p-4 flex flex-col items-center gap-2 text-center"
          style={{
            borderRight: '1px solid var(--canvas-dark-300)',
            background: 'oklch(from var(--canvas-dark-100) l c h / 0.4)',
          }}
        >
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-14 h-14 rounded-full text-[var(--canvas-dark-ink-muted)] bg-[var(--canvas-dark-100)] text-base font-semibold"
            style={{ boxShadow: 'var(--sh-inset)' }}
          >
            {post.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.avatarUrl}
                alt=""
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              post.username?.[0]?.toUpperCase() ?? '?'
            )}
          </span>
          <div className="min-w-0 w-full">
            {post.username ? (
              <div className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)] truncate">
                @{post.username}
              </div>
            ) : (
              <div className="text-sm font-semibold text-[var(--canvas-dark-ink-muted)] italic">
                Unknown
              </div>
            )}
            {isTopLevel && (
              <div
                className="mt-1 inline-block text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--brand)',
                  background: 'oklch(from var(--color-brand) l c h / 0.14)',
                }}
              >
                Original Poster
              </div>
            )}
          </div>
        </div>

        {/* Body column */}
        <div className="p-5 flex flex-col min-w-0">
          <header className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[var(--canvas-dark-300)]">
            <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--canvas-dark-ink-muted)]">
              <span
                className="px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'var(--sh-inset)',
                  color: 'var(--canvas-dark-ink-strong)',
                }}
              >
                #{postNumber}
              </span>
              <span>{relTime(post.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
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
        </div>
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
