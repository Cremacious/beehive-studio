'use client'

import { useState } from 'react'
import { Check, X, CornerDownRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { canReviewSuggestion, type HiveRole } from '@/lib/hive/permissions'
import type { SuggestionRow } from '@/lib/actions/hive-suggestions.actions'
import type { CollabMutations } from '@/lib/hooks/use-collab-data'
import { relTime } from './rel-time'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'

const SUGGESTION_COLOR = 'oklch(0.78 0.10 65)'

export type SuggestionViewer = {
  id: string
  role: HiveRole
}

type Props = {
  suggestion: SuggestionRow
  replies: SuggestionRow[]
  viewer: SuggestionViewer
  mutate: CollabMutations
  onAccepted?: () => void
}

export function SuggestionCard({
  suggestion,
  replies,
  viewer,
  mutate,
  onAccepted,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  const authorName =
    suggestion.author.username ?? suggestion.author.displayName ?? 'Unknown'
  const replyCount = replies.length
  const canReview = canReviewSuggestion(viewer.role) && !suggestion.resolved
  const original = suggestion.originalExcerpt ?? ''
  const replacement = suggestion.suggestedText ?? ''
  const hasBody = !!(suggestion.body && suggestion.body.trim())

  async function handleAccept() {
    if (accepting) return
    setAccepting(true)
    try {
      const res = await mutate.acceptSuggestion(suggestion.id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      if (res.data.orphan) {
        toast.message("Suggestion was orphaned. Chapter wasn't updated.")
      } else {
        toast.success('Suggestion accepted')
      }
      onAccepted?.()
    } finally {
      setAccepting(false)
    }
  }

  async function handleReject() {
    if (rejecting) return
    setRejecting(true)
    try {
      const res = await mutate.rejectSuggestion(suggestion.id)
      if (!res.success) toast.error(res.error)
      else toast.success('Suggestion rejected')
    } finally {
      setRejecting(false)
    }
  }

  async function submitReply() {
    const body = replyBody.trim()
    if (!body || submitting) return
    setSubmitting(true)
    try {
      const res = await mutate.replyToSuggestion({
        parentId: suggestion.id,
        body,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setReplyBody('')
      setReplyOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article
      className={
        'transition ' + (suggestion.resolved ? 'opacity-60' : '')
      }
      style={{
        borderRadius: 'var(--r-row)',
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        borderLeft: `3px solid ${SUGGESTION_COLOR}`,
      }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Avatar src={suggestion.author.avatarUrl} name={authorName} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-medium text-foreground truncate">
                @{authorName}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {relTime(suggestion.createdAt)}
              </span>
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full ml-0.5"
                style={{ background: SUGGESTION_COLOR }}
              />
              {suggestion.resolved ? (
                <span className="ml-1 rounded-sm bg-muted px-1 py-px text-[9px] uppercase tracking-wide text-muted-foreground">
                  {suggestion.acceptedAt ? 'Accepted' : 'Rejected'}
                </span>
              ) : null}
            </div>
          </div>
          {canReview ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleAccept()
                }}
                disabled={accepting || rejecting}
                aria-label="Accept suggestion"
                style={{
                  borderRadius: 'var(--r-btn)',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  boxShadow: 'var(--sh-tile)',
                }}
                className="flex h-6 w-6 items-center justify-center font-semibold transition hover:opacity-90 disabled:opacity-50"
              >
                {accepting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setRejectOpen(true)
                }}
                disabled={accepting || rejecting}
                aria-label="Reject suggestion"
                style={{
                  borderRadius: 'var(--r-btn)',
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))',
                  color: 'var(--canvas-dark-ink-strong)',
                  boxShadow: 'var(--sh-tile)',
                }}
                className="flex h-6 w-6 items-center justify-center font-semibold transition hover:text-destructive disabled:opacity-50"
              >
                {rejecting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="mt-2 w-full text-left"
        >
          {expanded ? (
            <div className="grid grid-cols-2 gap-2">
              <div
                style={{
                  borderRadius: 'var(--r-row)',
                  background: 'oklch(0.45 0.15 25 / 0.18)',
                }}
                className="p-1.5"
              >
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                  Original
                </div>
                <p className="text-[12px] leading-snug line-through opacity-70 whitespace-pre-wrap">
                  {original}
                </p>
              </div>
              <div
                style={{
                  borderRadius: 'var(--r-row)',
                  background: 'oklch(0.6 0.15 145 / 0.18)',
                }}
                className="p-1.5"
              >
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                  Suggested
                </div>
                <p className="text-[12px] leading-snug text-foreground whitespace-pre-wrap">
                  {replacement}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-[12.5px] leading-snug">
              <span className="line-through text-muted-foreground line-clamp-2">
                {original}
              </span>
              <span className="mx-1 text-muted-foreground">→</span>
              <span className="text-foreground line-clamp-2">{replacement}</span>
            </div>
          )}
          {!expanded && replyCount > 0 ? (
            <div className="mt-1 text-[10.5px] text-muted-foreground">
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </div>
          ) : null}
        </button>

        {expanded ? (
          <div className="mt-3 space-y-2">
            {hasBody ? (
              <p className="text-[12px] italic text-muted-foreground whitespace-pre-wrap">
                <RenderMentionsInText text={suggestion.body ?? ''} />
              </p>
            ) : null}

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
                          <RenderMentionsInText text={r.body ?? ''} />
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

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject suggestion?"
        description="The suggestion will be marked resolved without applying the change."
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleReject}
      />
    </article>
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
