'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { searchBooksAction } from '@/lib/actions/discover.actions'
import { addClubBookAction } from '@/lib/actions/book-clubs.actions'

type Props = {
  clubId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTarget?: 'QUEUE' | 'CURRENT'
}

type SearchHit = {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
}

type PickedBook = {
  bookId: string | null
  title: string
  author: string
  coverUrl: string | null
}

const EMPTY_PICK: PickedBook = {
  bookId: null,
  title: '',
  author: '',
  coverUrl: null,
}

export function AddBookToClubModal({ clubId, open, onOpenChange, defaultTarget }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'beehive' | 'external'>('beehive')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<PickedBook>(EMPTY_PICK)
  const [extTitle, setExtTitle] = useState('')
  const [extAuthor, setExtAuthor] = useState('')
  const [extCoverUrl, setExtCoverUrl] = useState('')
  const [target, setTarget] = useState<'QUEUE' | 'CURRENT'>(defaultTarget ?? 'QUEUE')
  const [isPending, startTransition] = useTransition()

  const reset = useCallback(() => {
    setTab('beehive')
    setQuery('')
    setResults([])
    setPicked(EMPTY_PICK)
    setExtTitle('')
    setExtAuthor('')
    setExtCoverUrl('')
    setTarget(defaultTarget ?? 'QUEUE')
  }, [defaultTarget])

  // Debounced Beehive search (mirrors C3 AddBookModal).
  useEffect(() => {
    if (tab !== 'beehive') return
    if (!query.trim()) {
      setResults([])
      return
    }
    const q = query.trim()
    setSearching(true)
    const handle = setTimeout(async () => {
      const result = await searchBooksAction({ query: q, limit: 10 })
      if (result.success) {
        setResults(result.data.rows)
      } else {
        setResults([])
      }
      setSearching(false)
    }, 300)
    return () => {
      clearTimeout(handle)
      setSearching(false)
    }
  }, [query, tab])

  const handlePick = (hit: SearchHit) => {
    setPicked({
      bookId: hit.bookId,
      title: hit.title,
      author: hit.author,
      coverUrl: hit.coverUrl,
    })
  }

  const clearPick = () => setPicked(EMPTY_PICK)

  const buildPayload = () => {
    if (tab === 'beehive') {
      if (!picked.bookId) return null
      return {
        clubId,
        bookId: picked.bookId,
        title: picked.title,
        author: picked.author,
        coverUrl: picked.coverUrl ?? undefined,
        status: target,
      }
    }
    const title = extTitle.trim()
    const author = extAuthor.trim()
    if (!title || !author) return null
    const coverUrl = extCoverUrl.trim()
    return {
      clubId,
      title,
      author,
      coverUrl: coverUrl ? coverUrl : undefined,
      status: target,
    }
  }

  const handleSubmit = () => {
    const payload = buildPayload()
    if (!payload) {
      toast.error('Title and author are required')
      return
    }
    const displayTitle = payload.title
    startTransition(async () => {
      const result = await addClubBookAction(payload)
      if (result.success) {
        toast.success(
          target === 'CURRENT'
            ? `${displayTitle} is now the current book`
            : `Added ${displayTitle} to the queue`,
        )
        reset()
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const canSubmit =
    tab === 'beehive'
      ? !!picked.bookId
      : extTitle.trim().length > 0 && extAuthor.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a book</DialogTitle>
        </DialogHeader>

        {/* Source tabs */}
        <div
          className="flex gap-1 p-1 rounded-[var(--r-pill)] text-sm"
          style={{ background: 'var(--canvas-dark-100)' }}
        >
          <button
            type="button"
            onClick={() => setTab('beehive')}
            className="flex-1 px-3 py-1.5 rounded-[var(--r-pill)] font-medium transition-colors"
            style={{
              background: tab === 'beehive' ? 'var(--brand)' : 'transparent',
              color:
                tab === 'beehive'
                  ? 'var(--brand-ink)'
                  : 'var(--canvas-dark-ink-muted)',
            }}
          >
            Search Beehive
          </button>
          <button
            type="button"
            onClick={() => setTab('external')}
            className="flex-1 px-3 py-1.5 rounded-[var(--r-pill)] font-medium transition-colors"
            style={{
              background: tab === 'external' ? 'var(--brand)' : 'transparent',
              color:
                tab === 'external'
                  ? 'var(--brand-ink)'
                  : 'var(--canvas-dark-ink-muted)',
            }}
          >
            Add external
          </button>
        </div>

        {/* Tab body */}
        {tab === 'beehive' ? (
          <div className="flex flex-col gap-3">
            {picked.bookId ? (
              <div
                className="flex items-center gap-3 p-3 rounded-[var(--r-row)]"
                style={{ background: 'var(--canvas-dark-100)' }}
              >
                {picked.coverUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={picked.coverUrl}
                    alt=""
                    className="w-12 h-16 object-cover rounded"
                  />
                ) : (
                  <div
                    className="w-12 h-16 rounded"
                    style={{ background: 'var(--canvas-dark-300)' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{picked.title}</div>
                  <div
                    className="text-sm truncate"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  >
                    {picked.author}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearPick}
                  className="p-1 rounded hover:opacity-80"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title or author…"
                    className="w-full pl-9 pr-3 py-2 rounded-[var(--r-row)] text-sm outline-none"
                    style={{
                      background: 'var(--canvas-dark-100)',
                      boxShadow: 'var(--sh-inset)',
                      color: 'var(--canvas-dark-ink)',
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {searching && (
                    <div
                      className="text-sm py-4 text-center"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      Searching…
                    </div>
                  )}
                  {!searching && query.trim() && results.length === 0 && (
                    <div
                      className="text-sm py-4 text-center"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      No matches
                    </div>
                  )}
                  {results.map((hit) => (
                    <div
                      key={hit.bookId}
                      className="flex items-center gap-3 p-2 rounded-[var(--r-row)]"
                      style={{ background: 'var(--canvas-dark-100)' }}
                    >
                      {hit.coverUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={hit.coverUrl}
                          alt=""
                          className="w-12 h-16 object-cover rounded"
                        />
                      ) : (
                        <div
                          className="w-12 h-16 rounded"
                          style={{ background: 'var(--canvas-dark-300)' }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{hit.title}</div>
                        <div
                          className="text-sm truncate"
                          style={{ color: 'var(--canvas-dark-ink-muted)' }}
                        >
                          {hit.author}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePick(hit)}
                        className="px-3 py-1.5 rounded-[var(--r-pill)] text-sm font-semibold"
                        style={{
                          background: 'var(--brand)',
                          color: 'var(--brand-ink)',
                        }}
                      >
                        Pick
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Title *</span>
              <input
                type="text"
                value={extTitle}
                onChange={(e) => setExtTitle(e.target.value)}
                maxLength={200}
                placeholder="The Way of Kings"
                className="px-3 py-2 rounded-[var(--r-row)] outline-none"
                style={{
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'var(--sh-inset)',
                  color: 'var(--canvas-dark-ink)',
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Author *</span>
              <input
                type="text"
                value={extAuthor}
                onChange={(e) => setExtAuthor(e.target.value)}
                maxLength={200}
                placeholder="Brandon Sanderson"
                className="px-3 py-2 rounded-[var(--r-row)] outline-none"
                style={{
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'var(--sh-inset)',
                  color: 'var(--canvas-dark-ink)',
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Cover URL (optional)</span>
              <input
                type="url"
                value={extCoverUrl}
                onChange={(e) => setExtCoverUrl(e.target.value)}
                maxLength={500}
                placeholder="https://…"
                className="px-3 py-2 rounded-[var(--r-row)] outline-none"
                style={{
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'var(--sh-inset)',
                  color: 'var(--canvas-dark-ink)',
                }}
              />
            </label>
          </div>
        )}

        {/* Target segmented control */}
        <div
          className="flex flex-col gap-2 pt-3 border-t"
          style={{ borderColor: 'var(--canvas-dark-200)' }}
        >
          <span className="text-sm font-medium">Where should this go?</span>
          <div
            className="flex gap-1 p-1 rounded-[var(--r-pill)] text-sm"
            style={{ background: 'var(--canvas-dark-100)' }}
          >
            <button
              type="button"
              onClick={() => setTarget('QUEUE')}
              className="flex-1 px-3 py-1.5 rounded-[var(--r-pill)] font-medium transition-colors"
              style={{
                background: target === 'QUEUE' ? 'var(--brand)' : 'transparent',
                color:
                  target === 'QUEUE'
                    ? 'var(--brand-ink)'
                    : 'var(--canvas-dark-ink-muted)',
              }}
            >
              Add to queue
            </button>
            <button
              type="button"
              onClick={() => setTarget('CURRENT')}
              className="flex-1 px-3 py-1.5 rounded-[var(--r-pill)] font-medium transition-colors"
              style={{
                background:
                  target === 'CURRENT' ? 'var(--brand)' : 'transparent',
                color:
                  target === 'CURRENT'
                    ? 'var(--brand-ink)'
                    : 'var(--canvas-dark-ink-muted)',
              }}
            >
              Set as current
            </button>
          </div>
          {target === 'CURRENT' && (
            <p
              className="text-xs"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              The previous current book will move to Past reads.
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
            className="px-4 py-2 rounded-[var(--r-pill)] text-sm font-medium"
            style={{
              background: 'var(--canvas-dark-100)',
              color: 'var(--canvas-dark-ink)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="px-4 py-2 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            {isPending ? 'Adding…' : 'Add book'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
