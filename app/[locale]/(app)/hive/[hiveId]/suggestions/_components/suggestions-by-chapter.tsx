'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  X,
  ExternalLink,
  MessageSquare,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  acceptSuggestionAction,
  rejectSuggestionAction,
  type PendingSuggestionsByChapter as PendingByChapter,
  type PendingSuggestionItem,
} from '@/lib/actions/hive-suggestions.actions'
import { relTime } from '@/components/hive/collab/rel-time'
import { HiveSectionDivider } from '../../_components/hive-section-divider'

type Props = {
  data: PendingByChapter[]
  hiveId: string
  locale: string
}

const MAX_EXCERPT = 150

function truncate(s: string, max = MAX_EXCERPT): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s
}

export function SuggestionsByChapter({ data, hiveId, locale }: Props) {
  if (data.length === 0) {
    return (
      <div className="px-6 pb-6">
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-base font-medium text-foreground">
            No pending suggestions
          </p>
          <p className="text-sm text-muted-foreground mt-1.5">
            Contributors and beta readers can suggest edits from any chapter view.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {data.map((group, i) => {
        const chapterLabel = group.chapterTitle
        return (
          <HiveSectionDivider
            key={group.chapterId}
            label={chapterLabel}
            hideTopBorder={i === 0}
          >
            <div className="flex flex-col gap-3">
              {group.suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  chapterId={group.chapterId}
                  hiveId={hiveId}
                  locale={locale}
                />
              ))}
            </div>
          </HiveSectionDivider>
        )
      })}
    </>
  )
}

function SuggestionCard({
  suggestion,
  chapterId,
  hiveId,
  locale,
}: {
  suggestion: PendingSuggestionItem
  chapterId: string
  hiveId: string
  locale: string
}) {
  const router = useRouter()
  const [accepting, startAccept] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, startReject] = useTransition()

  function handleAccept() {
    startAccept(async () => {
      const r = await acceptSuggestionAction(suggestion.id)
      if (!r.success) {
        toast.error(r.error || 'Failed to accept suggestion')
        return
      }
      if (r.data.orphan) {
        toast.warning("Suggestion was orphaned — chapter wasn't updated")
      } else {
        toast.success('Suggestion accepted')
      }
      router.refresh()
    })
  }

  function handleReject() {
    startReject(async () => {
      const r = await rejectSuggestionAction({
        id: suggestion.id,
        note: rejectNote.trim() || undefined,
      })
      if (!r.success) {
        toast.error(r.error || 'Failed to reject suggestion')
        return
      }
      toast.success('Suggestion rejected')
      setRejectOpen(false)
      setRejectNote('')
      router.refresh()
    })
  }

  const openHref = `/${locale}/hive/${hiveId}/chapters/${chapterId}#sug-${suggestion.id}`

  const authorLabel = suggestion.authorUsername
    ? `@${suggestion.authorUsername}`
    : 'Unknown'

  return (
    <article
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
      }}
      className="p-4"
    >
      <header className="flex items-center gap-2 text-xs mb-2">
        {suggestion.authorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={suggestion.authorAvatar}
            alt=""
            className="size-6 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="size-6 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
            {(suggestion.authorUsername ?? '?').slice(0, 2).toUpperCase()}
          </div>
        )}
        <span
          className="font-medium"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {authorLabel}
        </span>
        <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>·</span>
        <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          {relTime(suggestion.createdAt)}
        </span>
        {suggestion.hasReplies && (
          <span
            className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            title="This suggestion has replies"
          >
            <MessageSquare size={10} />
            Has replies
          </span>
        )}
      </header>

      <div className="text-sm leading-relaxed break-words mb-3">
        <span
          className="line-through"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {truncate(suggestion.originalExcerpt)}
        </span>
        <ArrowRight
          size={12}
          className="inline-block mx-1.5 align-baseline"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        />
        <span
          className="font-medium"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {truncate(suggestion.suggestedText)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAccept}
          disabled={accepting || rejecting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-pill)] text-xs font-semibold disabled:opacity-50"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
          }}
        >
          {accepting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Check size={12} />
          )}
          Accept
        </button>
        <button
          type="button"
          onClick={() => setRejectOpen(true)}
          disabled={accepting || rejecting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-pill)] text-xs font-semibold disabled:opacity-50"
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            color: 'var(--status-error)',
          }}
        >
          <X size={12} />
          Reject
        </button>
        <Link
          href={openHref}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium hover:underline"
          style={{ color: 'var(--brand)' }}
        >
          Open
          <ExternalLink size={12} />
        </Link>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>
              Reject suggestion
            </DialogTitle>
            <DialogDescription>
              Optionally leave a note for the suggester explaining your decision.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Optional note for the suggester"
            rows={4}
            disabled={rejecting}
          />
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReject}
              disabled={rejecting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {rejecting ? 'Rejecting…' : 'Reject suggestion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
