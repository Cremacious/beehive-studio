'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import type {
  ListSummary,
  ListOwner,
} from '@/lib/actions/reading-lists.actions'
import { deleteListAction } from '@/lib/actions/reading-lists.actions'
import { VisibilityPill } from '@/app/[locale]/(public)/discover/_components/visibility-pill'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatStrip } from '@/components/community/stat-strip'
import { FollowListButton } from './follow-list-button'
import { EditListMetadataDialog } from './edit-list-metadata-dialog'

type Props = {
  list: ListSummary
  owner: ListOwner
  isFollowing: boolean
  isOwner: boolean
  locale: string
  readCount: number
}

/**
 * T13 enriched: visibility pill (or 🤍 Auto for Liked), tag chips row,
 * created-on stat, owner ⋯ kebab with Edit metadata + Delete. Delete is
 * hidden for the Liked list (server returns LIKED_LIST_UNDELETABLE).
 */
export function ListDetailHeader({
  list,
  owner,
  isFollowing,
  isOwner,
  locale,
  readCount,
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDelete, startDeleteTransition] = useTransition()

  const isLiked = list.kind === 'LIKED'
  const tags = list.tags ?? []
  const createdLabel = new Date(list.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteListAction({ listId: list.id })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('List deleted')
      router.push(`/${locale}/community/reading-lists`)
    })
  }

  return (
    <section className="panel panel-pad mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isLiked ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]"
                title="Auto-managed Liked list"
              >
                🤍 Auto
              </span>
            ) : (
              <VisibilityPill visibility={list.visibility} />
            )}
            {tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
          <h1
            className="text-3xl font-bold text-[var(--brand)]"
            style={{ fontFamily: 'var(--font-comfortaa)' }}
          >
            {list.title}
          </h1>
          {list.description && (
            <p className="text-sm text-[var(--canvas-dark-ink)] mt-2 max-w-prose">
              <RenderMentionsInText text={list.description} />
            </p>
          )}
          {owner?.username && (
            <div className="mt-3 text-xs text-[var(--canvas-dark-ink-muted)]">
              <Link
                href={`/${locale}/u/${owner.username}`}
                className="hover:text-[var(--brand)] transition-colors"
              >
                by @{owner.username}
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isOwner && (
            <FollowListButton listId={list.id} initialFollowing={isFollowing} />
          )}
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[var(--canvas-dark-ink-muted)] hover:bg-[var(--canvas-dark-300)]"
                  aria-label="List actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setEditOpen(true)
                  }}
                >
                  Edit metadata
                </DropdownMenuItem>
                {!isLiked && (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      setConfirmDeleteOpen(true)
                    }}
                    className="text-destructive"
                  >
                    Delete list
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <hr className="divider my-5" />

      <StatStrip
        cells={[
          { value: list.bookCount ?? 0, label: 'Books' },
          { value: list.followerCount ?? 0, label: 'Followers' },
          { value: readCount, label: 'Read' },
          { value: createdLabel, label: 'Created' },
        ]}
      />

      {isOwner && (
        <>
          <EditListMetadataDialog
            initialList={list}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          {!isLiked && (
            <ConfirmDialog
              open={confirmDeleteOpen}
              onOpenChange={setConfirmDeleteOpen}
              title={`Delete "${list.title}"?`}
              description="This permanently removes the list and all of its books. This cannot be undone."
              variant="destructive"
              confirmLabel={pendingDelete ? 'Deleting…' : 'Delete list'}
              onConfirm={handleDelete}
            />
          )}
        </>
      )}
    </section>
  )
}
