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

// ─── Sticky palette ─────────────────────────────────────────────────────────
// 5 oklch tints. Choice is deterministic per post id so the same buzz always
// renders the same color across mounts. Rotation comes from the same hash so
// the corkboard feels natural without being chaotic across reloads.
const STICKY_VARIANTS = [
  // yellow (brand)
  {
    bg: 'linear-gradient(180deg, oklch(from var(--brand) l c h / 0.18), oklch(from var(--brand) l c h / 0.10))',
    border: 'oklch(from var(--brand) l c h / 0.32)',
    accent: 'var(--brand)',
  },
  // mint
  {
    bg: 'linear-gradient(180deg, oklch(0.78 0.13 165 / 0.18), oklch(0.78 0.13 165 / 0.08))',
    border: 'oklch(0.78 0.13 165 / 0.32)',
    accent: 'oklch(0.86 0.13 165)',
  },
  // pink
  {
    bg: 'linear-gradient(180deg, oklch(0.78 0.13 12 / 0.18), oklch(0.78 0.13 12 / 0.08))',
    border: 'oklch(0.78 0.13 12 / 0.32)',
    accent: 'oklch(0.86 0.13 12)',
  },
  // blue
  {
    bg: 'linear-gradient(180deg, oklch(0.74 0.13 250 / 0.18), oklch(0.74 0.13 250 / 0.08))',
    border: 'oklch(0.74 0.13 250 / 0.32)',
    accent: 'oklch(0.84 0.13 250)',
  },
  // lilac
  {
    bg: 'linear-gradient(180deg, oklch(0.78 0.11 305 / 0.18), oklch(0.78 0.11 305 / 0.08))',
    border: 'oklch(0.78 0.11 305 / 0.32)',
    accent: 'oklch(0.86 0.11 305)',
  },
] as const

// Rotation candidates — small angles so the board stays readable.
const ROTATIONS = ['-1.2deg', '-0.6deg', '0.5deg', '0.9deg', '1.4deg'] as const

// FNV-style id hash → stable integer for variant + rotation selection.
function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h
}

function pickStyle(id: string) {
  const h = hashId(id)
  const variant = STICKY_VARIANTS[h % STICKY_VARIANTS.length]
  const rotation = ROTATIONS[(h >> 4) % ROTATIONS.length]
  return { ...variant, rotation }
}

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
    new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 1000

  const style = pickStyle(post.id)

  return (
    <article
      className="relative break-inside-avoid"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--r-row)',
        padding: '20px 20px 18px',
        boxShadow:
          '0 8px 22px rgba(0,0,0,0.42), 0 1px 0 rgba(255,255,255,0.10) inset',
        transform: `rotate(${style.rotation})`,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'rotate(0deg) translateY(-2px)'
        e.currentTarget.style.boxShadow =
          '0 12px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.12) inset'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${style.rotation})`
        e.currentTarget.style.boxShadow =
          '0 8px 22px rgba(0,0,0,0.42), 0 1px 0 rgba(255,255,255,0.10) inset'
      }}
    >
      {/* Pin decoration */}
      <span
        aria-hidden
        className="absolute"
        style={{
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.4)',
        }}
      />

      {/* Header row */}
      <div className="flex items-center gap-2 mb-2.5">
        <span
          aria-hidden
          className="inline-flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'oklch(from var(--brand) l c h / 0.18)',
            color: 'var(--brand)',
          }}
        >
          {post.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.avatarUrl}
              alt=""
              className="rounded-full object-cover"
              style={{ width: 24, height: 24 }}
            />
          ) : (
            <span className="font-comfortaa font-semibold text-[11px]">
              {post.username?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </span>
        <span
          className="font-mono uppercase tracking-wider"
          style={{
            fontSize: '10.5px',
            letterSpacing: '0.08em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          <strong
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontWeight: 700,
            }}
          >
            @{post.username ?? 'unknown'}
          </strong>{' '}
          · {relTime(post.createdAt)}
          {edited && <span className="italic"> · edited</span>}
        </span>
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
                  className="p-1 transition-colors hover:bg-black/20 hover:text-[var(--canvas-dark-ink-strong)]"
                >
                  <MoreVertical size={15} />
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

      {/* Body — Newsreader for the writerly feel */}
      {post.body && post.body.trim() && (
        <p
          className="whitespace-pre-wrap break-words"
          style={{
            fontFamily: 'var(--font-prose, Newsreader, Georgia, serif)',
            fontSize: '14.5px',
            lineHeight: 1.55,
            color: 'var(--canvas-dark-ink-strong)',
            margin: 0,
          }}
        >
          <RenderMentionsInText text={post.body} />
        </p>
      )}

      {post.type === 'LINK' && post.linkUrl && <LinkCard url={post.linkUrl} />}

      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
