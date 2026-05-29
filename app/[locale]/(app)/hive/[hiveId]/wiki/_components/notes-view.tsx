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
            className="inline-flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 bg-brand text-brand-ink font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={12} /> New Note
          </button>
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12">
          No notes yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(n => (
            <article
              key={n.id}
              className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2 min-h-[120px]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <StickyNote size={12} />
                  {isPinned(n) && <Pin size={11} className="text-brand" />}
                </div>
                <span className="text-[10px] text-muted-foreground">{relTime(n.updatedAt)}</span>
              </div>
              <div className="font-comfortaa font-bold text-sm leading-tight">{n.title}</div>
              {noteExcerpt(n) && (
                <div className="text-xs text-muted-foreground line-clamp-3">{noteExcerpt(n)}</div>
              )}
              {n.authorUsername && (
                <div className="text-[10px] text-muted-foreground mt-auto">by @{n.authorUsername}</div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
