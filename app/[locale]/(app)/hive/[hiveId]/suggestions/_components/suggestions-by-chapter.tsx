'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  X,
  ArrowRight,
  MessageCircle,
  Loader2,
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

const MAX_EXCERPT = 180

function truncate(s: string, max = MAX_EXCERPT): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s
}

export function SuggestionsByChapter({ data, hiveId, locale }: Props) {
  if (data.length === 0) {
    return (
      <div className="px-6 pb-6">
        <p className="text-sm italic text-[var(--canvas-dark-ink-muted)]">
          No pending suggestions. Contributors and beta readers can suggest edits from any chapter view.
        </p>
      </div>
    )
  }

  return (
    <>
      {data.map((group, i) => (
        <HiveSectionDivider
          key={group.chapterId}
          label={group.chapterTitle}
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
      ))}
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
        toast.warning("Suggestion was orphaned. Chapter wasn't updated.")
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
  const username = suggestion.authorUsername ?? 'Unknown'
  const initials = (suggestion.authorUsername ?? '?').slice(0, 2).toUpperCase()
  const busy = accepting || rejecting

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
      <header className="flex items-center gap-3 mb-3">
        {suggestion.authorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={suggestion.authorAvatar}
            alt=""
            className="size-7 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="size-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold"
            style={{
              background: 'var(--canvas-dark-100)',
              boxShadow: 'var(--sh-inset)',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            {initials}
          </div>
        )}
        <span
          className="text-[13.5px] font-semibold"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {username}
        </span>
        <span
          className="font-mono text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {relTime(suggestion.createdAt)}
        </span>
        {suggestion.hasReplies && (
          <span
            className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              background: 'var(--canvas-dark-100)',
              boxShadow: 'var(--sh-inset)',
              color: 'var(--canvas-dark-ink-muted)',
              borderRadius: 'var(--r-pill)',
              padding: '4px 9px',
            }}
            title="This suggestion has replies"
          >
            <MessageCircle size={12} />
            replies
          </span>
        )}
      </header>

      <div
        className="flex items-start gap-2 flex-wrap"
        style={{
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          borderRadius: 'var(--r-row)',
          padding: '12px 14px',
          fontFamily: 'var(--font-prose)',
          fontSize: '15px',
          lineHeight: 1.6,
        }}
      >
        <span
          className="line-through opacity-80"
          style={{
            color: 'var(--status-error)',
            textDecorationColor:
              'oklch(from var(--status-error) l c h / 0.7)',
          }}
        >
          {truncate(suggestion.originalExcerpt)}
        </span>
        <ArrowRight
          size={14}
          className="flex-shrink-0 mt-[5px]"
          style={{ color: 'var(--canvas-dark-ink-faint)' }}
        />
        <span
          className="font-medium"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {truncate(suggestion.suggestedText)}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy}
          className="inline-flex items-center gap-1.5 font-semibold transition-[transform,background] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-pill)',
            padding: '7px 16px',
            fontSize: '13px',
          }}
        >
          {accepting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          Accept
        </button>
        <button
          type="button"
          onClick={() => setRejectOpen(true)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 font-semibold transition-[transform,color] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            color: 'var(--status-error)',
            borderRadius: 'var(--r-pill)',
            padding: '7px 16px',
            fontSize: '13px',
          }}
        >
          <X size={14} />
          Reject
        </button>
        <Link
          href={openHref}
          className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium hover:underline underline-offset-2"
          style={{ color: 'var(--brand)' }}
        >
          Open in chapter
          <ArrowRight size={13} />
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
