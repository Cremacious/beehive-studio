'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pin, StickyNote } from 'lucide-react'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type Note = BinderItemRow & { authorUsername: string | null }

function isPinned(n: Note): boolean {
  const c = n.content as { pinned?: boolean } | null
  return !!c?.pinned
}

function noteExcerpt(n: Note): string {
  const c = n.content as { body?: string } | null
  if (!c?.body) return ''
  return c.body.length > 140 ? c.body.slice(0, 140) + '…' : c.body
}

export function NotesView({
  notes,
  bookId,
  canEdit,
}: {
  notes: Note[]
  bookId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const sorted = [...notes].sort((a, b) => {
    const pa = isPinned(a) ? 1 : 0
    const pb = isPinned(b) ? 1 : 0
    if (pa !== pb) return pb - pa
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  function handleAdd() {
    startTransition(async () => {
      const maxOrder = Math.max(0, ...notes.map(n => n.order ?? 0))
      const r = await createBinderItemAction({
        bookId,
        parentId: null,
        type: 'research_note',
        title: 'New note',
        order: maxOrder + 1,
        content: { body: '' },
      })
      if (!r.success) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
            className="inline-flex items-center gap-1.5 text-sm font-geist font-semibold px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))] disabled:opacity-50"
          >
            <Plus size={14} /> New Note
          </button>
        </div>
      )}
      {sorted.length === 0 ? (
        <div
          className="text-center text-sm py-12"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          No notes yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(n => (
            <article
              key={n.id}
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-tile)',
                border: 'var(--br-card)',
              }}
              className="p-4 flex flex-col gap-2 min-h-[120px]"
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className="inline-flex items-center gap-1.5 text-[11px]"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  <StickyNote size={12} />
                  {isPinned(n) && <Pin size={11} className="text-brand" />}
                </div>
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {relTime(n.updatedAt)}
                </span>
              </div>
              <div
                className="font-comfortaa font-semibold text-sm leading-tight"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                {n.title}
              </div>
              {noteExcerpt(n) && (
                <div
                  className="text-xs line-clamp-3"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {noteExcerpt(n)}
                </div>
              )}
              {n.authorUsername && (
                <div
                  className="text-[10px] mt-auto font-mono"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  @{n.authorUsername}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
