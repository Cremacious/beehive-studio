'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MoreVertical, Pencil, Trash2 } from 'lucide-react'
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
    <p key={i} className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
      {line || ' '}
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

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href={`/${locale}/hive/${hiveId}/discussions`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={12} />
          Back to discussions
        </Link>

        <PostCard
          post={post}
          isTopLevel
          viewerRole={viewerRole}
          viewerUserId={viewerUserId}
          locale={locale}
          hiveId={hiveId}
          onReplyClick={() => focusReplyWithMention(post.username)}
        />

        <div className="mt-6">
          <h2 className="font-comfortaa font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">
            Reply
          </h2>
          <Textarea
            ref={replyRef}
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="Add to the conversation…"
            rows={3}
          />
          <div className="flex justify-end mt-2">
            <Button
              onClick={submitReply}
              disabled={!replyDraft.trim() || replying}
              size="sm"
            >
              {replying ? 'Posting…' : 'Reply'}
            </Button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="font-comfortaa font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </h2>
          {replies.length === 0 ? (
            <div className="px-3 py-8 rounded-md border border-dashed border-border text-center text-sm text-muted-foreground italic">
              No replies yet.
            </div>
          ) : (
            <div className="space-y-3">
              {replies.map((reply) => (
                <PostCard
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
      </div>
    </main>
  )
}

function PostCard({
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

  // Top-level "title" is the first 80 chars of body, conventionally shown
  // on the first line. We show the full body content; if the body has a
  // composed title prefix (compose modal does this), it appears naturally.
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
      className={
        'rounded-md border border-border p-4 ' +
        (isTopLevel ? 'bg-card' : 'bg-muted/20')
      }
    >
      <header className="flex items-start gap-3 mb-2">
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground bg-muted/40 shrink-0"
        >
          {post.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            post.username?.[0]?.toUpperCase() ?? '?'
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isTopLevel && post.topic && <TopicPill topic={post.topic} />}
            {post.username && (
              <span className="text-sm font-medium text-foreground">
                @{post.username}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {relTime(post.createdAt)}
            </span>
          </div>
        </div>
        {(canEdit || !isTopLevel) && (
          <div className="flex items-center gap-1">
            {!isTopLevel && (
              <button
                type="button"
                onClick={onReplyClick}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40"
              >
                Reply
              </button>
            )}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Post actions"
                    className="p-1 rounded hover:bg-muted/40 text-muted-foreground"
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
        <div className="space-y-1 pl-11">{renderBody(post.body)}</div>
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
