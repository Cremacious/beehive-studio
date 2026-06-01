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
    new Date(post.updatedAt).getTime() -
      new Date(post.createdAt).getTime() >
      1000

  return (
    <article
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
      }}
      className="flex items-start gap-3 p-5"
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 mt-0.5"
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
      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-2 text-[11px] font-mono"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <span
            className="font-comfortaa font-semibold text-sm"
            style={{ color: 'var(--canvas-dark-ink-strong)' }}
          >
            @{post.username ?? 'unknown'}
          </span>
          <span>·</span>
          <span>{relTime(post.createdAt)}</span>
          {edited && <span className="italic">(edited)</span>}
        </div>

        {/* Body */}
        {post.type === 'TEXT' ? (
          <div
            className="mt-2 text-sm font-prose leading-relaxed whitespace-pre-wrap break-words"
            style={{ color: 'var(--canvas-dark-ink)' }}
          >
            {post.body}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {post.body && (
              <div
                className="text-sm font-prose leading-relaxed whitespace-pre-wrap break-words"
                style={{ color: 'var(--canvas-dark-ink)' }}
              >
                {post.body}
              </div>
            )}
            {post.linkUrl && <LinkCard url={post.linkUrl} />}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1">
          <LikeButton
            buzzId={post.id}
            initialLiked={post.viewerLiked}
            initialCount={post.likeCount}
          />
        </div>
      </div>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Post actions"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                borderRadius: 'var(--r-btn)',
              }}
              className="p-1 hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))] shrink-0"
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
      )}

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
