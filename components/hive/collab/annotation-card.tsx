'use client'

import { useState } from 'react'
import { Check, CornerDownRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  canResolveAnnotation,
  type HiveRole,
} from '@/lib/hive/permissions'
import type {
  AnnotationLayer,
  AnnotationRow,
} from '@/lib/actions/hive-annotations.actions'
import type { CollabMutations } from '@/lib/hooks/use-collab-data'
import { relTime } from './rel-time'

export type Viewer = {
  id: string
  role: HiveRole
  bookOwnerId: string
}

const LAYER_COLORS: Record<AnnotationLayer, string> = {
  GRAMMAR:    'oklch(0.72 0.10 165)',
  PLOT:       'oklch(0.72 0.13 25)',
  TONE:       'oklch(0.72 0.13 290)',
  CONTINUITY: 'oklch(0.72 0.10 200)',
  GENERAL:    'oklch(0.74 0.13 80)',
}

type Props = {
  annotation: AnnotationRow
  replies: AnnotationRow[]
  viewer: Viewer
  mutate: CollabMutations
  onReplyAdded?: () => void
}

export function AnnotationCard({
  annotation,
  replies,
  viewer,
  mutate,
  onReplyAdded,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const color = LAYER_COLORS[annotation.layer]
  const authorName =
    annotation.author.username ??
    annotation.author.displayName ??
    'Unknown'
  const replyCount = replies.length
  const canResolve = canResolveAnnotation(
    { authorId: annotation.authorId },
    viewer.role,
    viewer.id,
    viewer.bookOwnerId,
  )

  async function toggleResolved() {
    if (toggling) return
    setToggling(true)
    try {
      const res = annotation.resolved
        ? await mutate.unresolveAnnotation(annotation.id)
        : await mutate.resolveAnnotation(annotation.id)
      if (!res.success) toast.error(res.error)
    } finally {
      setToggling(false)
    }
  }

  async function submitReply() {
    const body = replyBody.trim()
    if (!body || submitting) return
    setSubmitting(true)
    try {
      const res = await mutate.replyToAnnotation({
        parentId: annotation.id,
        body,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setReplyBody('')
      setReplyOpen(false)
      onReplyAdded?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={
        'rounded-md border border-border bg-[oklch(from_var(--paper-100)_l_c_h)] shadow-sm transition ' +
        (annotation.resolved ? 'opacity-60' : '')
      }
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Avatar
            src={annotation.author.avatarUrl}
            name={authorName}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-medium text-foreground truncate">
                @{authorName}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {relTime(annotation.createdAt)}
              </span>
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full ml-0.5"
                style={{ background: color }}
              />
              {annotation.resolved ? (
                <span className="ml-1 rounded-sm bg-muted px-1 py-px text-[9px] uppercase tracking-wide text-muted-foreground">
                  Resolved
                </span>
              ) : null}
            </div>
          </div>
          {canResolve ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void toggleResolved()
              }}
              disabled={toggling}
              aria-label={annotation.resolved ? 'Unresolve' : 'Resolve'}
              className={
                'flex h-6 w-6 items-center justify-center rounded-md border transition ' +
                (annotation.resolved
                  ? 'border-brand bg-brand/15 text-brand'
                  : 'border-border text-muted-foreground hover:border-brand hover:text-foreground')
              }
            >
              {toggling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="mt-2 w-full text-left"
        >
          <p
            className={
              'text-[12.5px] leading-snug text-foreground whitespace-pre-wrap ' +
              (annotation.resolved ? 'line-through' : '') +
              (expanded ? '' : ' line-clamp-2')
            }
          >
            {annotation.body}
          </p>
          {!expanded && replyCount > 0 ? (
            <div className="mt-1 text-[10.5px] text-muted-foreground">
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </div>
          ) : null}
        </button>

        {expanded ? (
          <div className="mt-3 space-y-2">
            {replies.length > 0 ? (
              <div className="space-y-1.5 border-l border-border pl-2.5">
                {replies.map((r) => {
                  const rName =
                    r.author.username ?? r.author.displayName ?? 'Unknown'
                  return (
                    <div key={r.id} className="flex gap-2">
                      <Avatar src={r.author.avatarUrl} name={rName} small />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                          <span className="font-medium text-foreground">
                            @{rName}
                          </span>
                          <span>·</span>
                          <span>{relTime(r.createdAt)}</span>
                        </div>
                        <p className="text-[12px] leading-snug text-foreground whitespace-pre-wrap">
                          {r.body}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {replyOpen ? (
              <div className="space-y-1.5">
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Reply…"
                  rows={2}
                  className="text-xs"
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplyOpen(false)
                      setReplyBody('')
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={submitReply}
                    disabled={!replyBody.trim() || submitting}
                  >
                    {submitting ? 'Sending…' : 'Reply'}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setReplyOpen(true)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <CornerDownRight className="h-3 w-3" />
                Reply
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Avatar({
  src,
  name,
  small,
}: {
  src: string | null
  name: string
  small?: boolean
}) {
  const size = small ? 'h-4 w-4 text-[8px]' : 'h-5 w-5 text-[9px]'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        className={`${size} rounded-full object-cover shrink-0`}
      />
    )
  }
  return (
    <span
      className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-medium`}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
