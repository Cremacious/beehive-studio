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
import type { SparkVisibility } from '@/db/schema/social'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FollowListButton } from './follow-list-button'
import { EditListMetadataDialog } from './edit-list-metadata-dialog'

type Props = {
  list: ListSummary
  owner: ListOwner
  isFollowing: boolean
  isOwner: boolean
  locale: string
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
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDelete, startDeleteTransition] = useTransition()

  const isLiked = list.kind === 'LIKED'
  const tags = list.tags ?? []
  const createdLabel = new Date(list.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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
      router.push(`/${locale}/reading-lists`)
    })
  }

  return (
    <header className="mb-6">
      <div className="flex items-start gap-3 mb-2">
        <h1
          className="text-3xl font-bold text-[var(--brand)] flex-1 min-w-0"
          style={{ fontFamily: 'var(--font-comfortaa)' }}
        >
          {list.title}
        </h1>

        {isLiked ? (
          <span
            className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]"
            title="Auto-managed Liked list"
          >
            🤍 Auto
          </span>
        ) : list.visibility !== 'PUBLIC' ? (
          <span className="shrink-0">
            <VisibilityPill visibility={list.visibility as SparkVisibility} />
          </span>
        ) : null}

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md text-[var(--canvas-dark-ink-muted)] hover:bg-[var(--canvas-dark-300)]"
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

      {list.description && (
        <p className="text-sm text-[var(--canvas-dark-ink)] mb-3 max-w-prose">
          {list.description}
        </p>
      )}

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1 mb-3">
          {tags.map((tag) => (
            <li
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--canvas-dark-ink-muted)] flex-wrap">
          {owner?.username && (
            <>
              <Link
                href={`/${locale}/u/${owner.username}`}
                className="hover:text-[var(--brand)] transition-colors"
              >
                by @{owner.username}
              </Link>
              <span>·</span>
            </>
          )}
          <span>{list.bookCount ?? 0} books</span>
          <span>·</span>
          <span>{list.followerCount ?? 0} followers</span>
          <span>·</span>
          <span>Created {createdLabel}</span>
        </div>
        {!isOwner && (
          <FollowListButton listId={list.id} initialFollowing={isFollowing} />
        )}
      </div>

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
    </header>
  )
}
