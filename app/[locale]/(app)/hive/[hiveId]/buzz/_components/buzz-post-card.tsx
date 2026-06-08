'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { BuzzPostSummary } from '@/lib/actions/hive-buzz.actions'
import { canEditBuzz, type HiveRole } from '@/lib/hive/permissions'
import { deleteBuzzPostAction } from '@/lib/actions/hive-buzz.actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LikeButton } from './like-button'
import { LinkCard } from './link-card'
import { EditBuzzModal } from './edit-buzz-modal'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'

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

function deriveTitleAndExcerpt(body: string): { title: string; excerpt: string | null } {
  const trimmed = body.trim()
  const firstNewline = trimmed.indexOf('\n')
  if (firstNewline === -1) {
    return { title: trimmed.slice(0, 80), excerpt: null }
  }
  const title = trimmed.slice(0, firstNewline).slice(0, 80)
  const remainder = trimmed.slice(firstNewline + 1).trim()
  return { title, excerpt: remainder || null }
}

export function BuzzPostCard({
  post,
  viewerRole,
  viewerUserId,
}: {
  post: BuzzPostSummary
  viewerRole: HiveRole
  viewerUserId: string
}) {
  const router = useRouter()
  const canEdit = canEditBuzz({ authorId: post.authorId }, viewerRole, viewerUserId)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleDelete() {
    const res = await deleteBuzzPostAction(post.id)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success('Post deleted')
    router.refresh()
  }

  const edited =
    post.updatedAt &&
    new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 1000

  const { title, excerpt } = deriveTitleAndExcerpt(post.body ?? '')

  return (
    <article
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
        padding: 24,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-[9px] mb-3">
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 overflow-hidden"
          style={{
            background: 'oklch(from var(--brand) l c h / 0.14)',
            color: 'var(--brand)',
          }}
        >
          {post.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <span className="font-comfortaa font-semibold text-xs">
              {post.username?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </span>
        <span
          className="font-comfortaa font-semibold text-[14px]"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          @{post.username ?? 'unknown'}
        </span>
        <span
          className="font-mono text-[11px] tracking-wider"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          · {relTime(post.createdAt)}
        </span>
        {edited && (
          <span
            className="italic font-mono text-[11px] tracking-wider"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            · (edited)
          </span>
        )}
        {canEdit && (
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Post actions"
                  style={{
                    color: 'var(--canvas-dark-ink-muted)',
                    borderRadius: 'var(--r-btn)',
                  }}
                  className="p-1 transition-colors hover:bg-[var(--canvas-dark-100)] hover:text-[var(--canvas-dark-ink-strong)]"
                >
                  <MoreVertical size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil size={14} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setDeleteOpen(true)
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {title && (
        <h3
          className="font-comfortaa font-bold text-[16px] mt-1"
          style={{ color: 'var(--brand)', margin: '8px 0 0' }}
        >
          <RenderMentionsInText text={title} />
        </h3>
      )}
      {excerpt && (
        <p
          className="text-[14px] mt-1 line-clamp-2 whitespace-pre-wrap break-words"
          style={{ color: 'var(--canvas-dark-ink)', lineHeight: 1.5, margin: '6px 0 0' }}
        >
          <RenderMentionsInText text={excerpt} />
        </p>
      )}

      {post.type === 'LINK' && post.linkUrl && <LinkCard url={post.linkUrl} />}

      <div className="flex items-center gap-4 mt-3">
        <LikeButton
          buzzId={post.id}
          initialLiked={post.viewerLiked}
          initialCount={post.likeCount}
        />
      </div>

      {canEdit && (
        <>
          <EditBuzzModal open={editOpen} onOpenChange={setEditOpen} post={post} />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete this buzz post?"
            description="This can't be undone."
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={handleDelete}
          />
        </>
      )}
    </article>
  )
}
