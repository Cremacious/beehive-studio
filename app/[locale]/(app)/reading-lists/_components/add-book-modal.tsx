'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { searchBooksAction } from '@/lib/actions/discover.actions'
import { addBookToListAction } from '@/lib/actions/reading-lists.actions'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'

type Props = {
  listId: string
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function AddBookModal({ listId, open, onOpenChange }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'beehive' | 'external'>('beehive')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<PickedBook>(EMPTY_PICK)
  const [extTitle, setExtTitle] = useState('')
  const [extAuthor, setExtAuthor] = useState('')
  const [extCoverUrl, setExtCoverUrl] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [commentary, setCommentary] = useState('')
  const [isRead, setIsRead] = useState(false)
  const [isPending, startTransition] = useTransition()

  const reset = useCallback(() => {
    setTab('beehive')
    setQuery('')
    setResults([])
    setPicked(EMPTY_PICK)
    setExtTitle('')
    setExtAuthor('')
    setExtCoverUrl('')
    setRating(null)
    setCommentary('')
    setIsRead(false)
  }, [])

  // Debounced search.
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
        listId,
        bookId: picked.bookId,
        title: picked.title,
        author: picked.author,
        coverUrl: picked.coverUrl ?? undefined,
        isRead,
        rating: rating ?? undefined,
        commentary: commentary.trim() ? commentary.trim() : undefined,
      }
    }
    const title = extTitle.trim()
    const author = extAuthor.trim()
    if (!title || !author) return null
    const coverUrl = extCoverUrl.trim()
    return {
      listId,
      title,
      author,
      coverUrl: coverUrl ? coverUrl : undefined,
      isRead,
      rating: rating ?? undefined,
      commentary: commentary.trim() ? commentary.trim() : undefined,
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
      const result = await addBookToListAction(payload)
      if (result.success) {
        toast.success(`Added ${displayTitle}`)
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

        {/* Tabs */}
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
                  // eslint-disable-next-line @next/next/no-img-element
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
                        // eslint-disable-next-line @next/next/no-img-element
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

        {/* Shared metadata block */}
        <MetadataBlock
          rating={rating}
          onRatingChange={setRating}
          commentary={commentary}
          onCommentaryChange={setCommentary}
          isRead={isRead}
          onIsReadChange={setIsRead}
        />

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

export function MetadataBlock({
  rating,
  onRatingChange,
  commentary,
  onCommentaryChange,
  isRead,
  onIsReadChange,
}: {
  rating: number | null
  onRatingChange: (next: number | null) => void
  commentary: string
  onCommentaryChange: (next: string) => void
  isRead: boolean
  onIsReadChange: (next: boolean) => void
}) {
  return (
    <div
      className="flex flex-col gap-3 pt-3 border-t"
      style={{ borderColor: 'var(--canvas-dark-200)' }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Rating</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = rating !== null && star <= rating
            return (
              <button
                key={star}
                type="button"
                onClick={() =>
                  onRatingChange(rating === star ? null : star)
                }
                aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                className="p-0.5"
              >
                <Star
                  className="h-5 w-5"
                  style={{
                    fill: filled ? 'var(--brand)' : 'transparent',
                    color: filled
                      ? 'var(--brand)'
                      : 'var(--canvas-dark-ink-muted)',
                  }}
                />
              </button>
            )
          })}
          {rating !== null && (
            <button
              type="button"
              onClick={() => onRatingChange(null)}
              className="ml-2 text-xs"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Commentary (optional)</span>
        <MentionableTextarea
          value={commentary}
          onChange={onCommentaryChange}
          maxLength={500}
          rows={3}
          placeholder="What did you think?"
          className="px-3 py-2 rounded-[var(--r-row)] outline-none resize-none"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink)',
          }}
        />
        <span
          className="text-xs self-end"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {commentary.length}/500
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isRead}
          onChange={(e) => onIsReadChange(e.target.checked)}
          className="h-4 w-4"
        />
        <span>I&apos;ve read this book</span>
      </label>
    </div>
  )
}
