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

  return (
    <article className="flex items-start gap-3 px-4 py-3.5 rounded-md border border-border bg-card">
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground bg-muted/40 shrink-0 mt-0.5"
      >
        {post.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.avatarUrl}
            alt=""
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          post.username?.[0]?.toUpperCase() ?? '?'
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            @{post.username ?? 'unknown'}
          </span>
          <span>·</span>
          <span>{relTime(post.createdAt)}</span>
          {post.updatedAt &&
            new Date(post.updatedAt).getTime() -
              new Date(post.createdAt).getTime() >
              1000 && <span className="italic">(edited)</span>}
        </div>

        {/* Body */}
        {post.type === 'TEXT' ? (
          <div className="mt-1.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {post.body}
          </div>
        ) : (
          <div className="mt-1.5 space-y-2">
            {post.body && (
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                {post.body}
              </div>
            )}
            {post.linkUrl && <LinkCard url={post.linkUrl} />}
          </div>
        )}

        <div className="mt-2 flex items-center gap-1">
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
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 shrink-0"
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
