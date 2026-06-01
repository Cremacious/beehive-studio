'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
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
  const totalPending = data.reduce((sum, g) => sum + g.suggestions.length, 0)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggle(chapterId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-comfortaa font-bold text-2xl text-foreground">
              Edit Suggestions
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review pending suggestions across this hive&apos;s chapters.
            </p>
          </div>
          {totalPending > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'var(--color-brand)',
                color: 'var(--brand-ink, oklch(0.18 0.02 60))',
              }}
            >
              {totalPending} pending
            </span>
          )}
        </header>

        {data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-base font-medium text-foreground">
              No pending suggestions
            </p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Contributors and beta readers can suggest edits from any chapter view.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((group) => (
              <ChapterGroup
                key={group.chapterId}
                group={group}
                hiveId={hiveId}
                locale={locale}
                collapsed={collapsed.has(group.chapterId)}
                onToggle={() => toggle(group.chapterId)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function ChapterGroup({
  group,
  hiveId,
  locale,
  collapsed,
  onToggle,
}: {
  group: PendingByChapter
  hiveId: string
  locale: string
  collapsed: boolean
  onToggle: () => void
}) {
  const chapterHref = `/${locale}/hive/${hiveId}/chapters/${group.chapterId}`

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand chapter' : 'Collapse chapter'}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <Link
          href={chapterHref}
          className="font-comfortaa font-bold text-base text-foreground hover:text-brand hover:underline"
        >
          {group.chapterTitle}
        </Link>
        <span className="text-xs text-muted-foreground">
          ({group.suggestions.length} pending)
        </span>
      </div>
      {!collapsed && (
        <ul className="divide-y divide-border">
          {group.suggestions.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              chapterId={group.chapterId}
              hiveId={hiveId}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function SuggestionRow({
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
    <li className="flex items-start gap-3 px-4 py-3">
      {suggestion.authorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={suggestion.authorAvatar}
          alt=""
          className="size-7 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="size-7 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
          {(suggestion.authorUsername ?? '?').slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span className="font-medium text-foreground">{authorLabel}</span>
          <span>·</span>
          <span>{relTime(suggestion.createdAt)}</span>
          {suggestion.hasReplies && (
            <>
              <span>·</span>
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold"
                title="This suggestion has replies"
              >
                <MessageSquare size={10} />
                Has replies
              </span>
            </>
          )}
        </div>
        <div className="text-sm leading-relaxed break-words">
          <span className="line-through text-muted-foreground">
            {truncate(suggestion.originalExcerpt)}
          </span>
          <ArrowRight
            size={12}
            className="inline-block mx-1.5 text-muted-foreground align-baseline"
          />
          <span className="font-medium text-foreground">
            {truncate(suggestion.suggestedText)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={handleAccept}
          disabled={accepting || rejecting}
          aria-label="Accept suggestion"
          title="Accept suggestion"
          className="inline-flex items-center justify-center size-8 rounded-md hover:bg-brand/20 disabled:opacity-50"
          style={{ color: 'var(--color-brand)' }}
        >
          {accepting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setRejectOpen(true)}
          disabled={accepting || rejecting}
          aria-label="Reject suggestion"
          title="Reject suggestion"
          className="inline-flex items-center justify-center size-8 rounded-md border border-border text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          <X size={16} />
        </button>
        <Link
          href={openHref}
          aria-label="Open in chapter"
          title="Open in chapter"
          className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink size={16} />
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
    </li>
  )
}
