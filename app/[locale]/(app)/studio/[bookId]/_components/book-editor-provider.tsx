'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type { ChapterData } from '@/lib/actions/chapter.actions'
import {
  getChapterAction,
  saveChapterAction,
  updateChapterNotesAction,
  updateChapterStatusAction,
} from '@/lib/actions/chapter.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveStatus = 'saved' | 'saving' | 'unsaved'

const CHAPTER_TYPES = new Set<BinderItemRow['type']>(['chapter', 'front_matter', 'back_matter'])

type BookEditorContextValue = {
  bookId: string
  bookTitle: string
  locale: string
  binderItems: BinderItemRow[]
  activeItemId: string | null
  activeItem: BinderItemRow | null
  activeChapter: ChapterData | null
  saveStatus: SaveStatus
  wordCount: number
  errors: string[]
  flashes: string[]
  pushFlash: (msg: string) => void
  setActiveItemId: (id: string | null) => void
  addBinderItem: (item: BinderItemRow) => void
  updateBinderItem: (id: string, patch: Partial<BinderItemRow>) => void
  removeBinderItem: (id: string) => void
  setBinderItems: React.Dispatch<React.SetStateAction<BinderItemRow[]>>
  updateChapterContent: (content: unknown) => void
  flushPendingSave: () => Promise<void>
  updateChapterStatus: (status: ChapterData['status']) => Promise<void>
  updateChapterNotes: (notes: string | null) => void
  dismissError: (index: number) => void
  focusMode: boolean
  toggleFocusMode: () => void
  corkboardMode: boolean
  toggleCorkboardMode: () => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const BookEditorContext = createContext<BookEditorContextValue | null>(null)

export function useBookEditor(): BookEditorContextValue {
  const ctx = useContext(BookEditorContext)
  if (!ctx) throw new Error('useBookEditor must be used within BookEditorProvider')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type Props = {
  bookId: string
  bookTitle: string
  locale: string
  initialBinderItems: BinderItemRow[]
  children: React.ReactNode
}

export function BookEditorProvider({ bookId, bookTitle, locale, initialBinderItems, children }: Props) {
  const [binderItems, setBinderItems] = useState<BinderItemRow[]>(initialBinderItems)
  const [activeItemId, setActiveItemIdState] = useState<string | null>(null)
  const [chapterCache, setChapterCache] = useState<Map<string, ChapterData>>(new Map())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [wordCount, setWordCount] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [focusMode, setFocusMode] = useState(false)
  const toggleFocusMode = useCallback(() => setFocusMode(f => !f), [])
  const [corkboardMode, setCorkboardMode] = useState(false)
  const toggleCorkboardMode = useCallback(() => setCorkboardMode(c => !c), [])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ itemId: string; content: unknown } | null>(null)
  // Mirror of chapterCache for synchronous reads without triggering setState
  const chapterCacheRef = useRef(chapterCache)
  chapterCacheRef.current = chapterCache

  const pushError = useCallback((msg: string) => {
    setErrors(prev => [...prev, msg])
  }, [])

  const [flashes, setFlashes] = useState<string[]>([])

  const pushFlash = useCallback((msg: string) => {
    setFlashes(prev => [...prev, msg])
    setTimeout(() => {
      setFlashes(prev => prev.slice(1))
    }, 1500)
  }, [])

  // Performs the actual save. Pulled out of updateChapterContent so it can also be
  // invoked synchronously by chapter-switch flush, by Cmd+S (future task), and by
  // beforeunload (future task).
  const performSave = useCallback(async (targetItemId: string, content: unknown) => {
    const cachedChapter = chapterCacheRef.current.get(targetItemId) ?? null
    if (!cachedChapter) {
      // Nothing to save — return to 'unsaved' so a future keystroke retriggers.
      setSaveStatus('unsaved')
      return
    }

    setSaveStatus('saving')

    const result = await saveChapterAction(cachedChapter.id, content)
    if (result.success) {
      setSaveStatus('saved')
      setWordCount(result.data.wordCount)
      setChapterCache(prev => {
        const m = new Map(prev)
        const ch = m.get(targetItemId)
        if (ch) m.set(targetItemId, { ...ch, content, wordCount: result.data.wordCount })
        return m
      })
    } else {
      setSaveStatus('unsaved')
      pushError("Couldn't save. Retrying…")
    }
  }, [pushError])

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = pendingSaveRef.current
    if (!pending) return
    pendingSaveRef.current = null
    await performSave(pending.itemId, pending.content)
  }, [performSave])

  const setActiveItemId = useCallback((id: string | null) => {
    // Flush any pending save for the outgoing chapter so its edits aren't lost.
    // Fire-and-forget: performSave uses pendingSaveRef's captured itemId, so the
    // save lands on the correct chapter even after this switch completes.
    void flushPendingSave()

    if (id === null) {
      setActiveItemIdState(null)
      return
    }

    const item = binderItems.find(x => x.id === id)
    if (!item) return

    setActiveItemIdState(id)

    if (!CHAPTER_TYPES.has(item.type)) return

    // Cache hit — nothing to do
    if (chapterCacheRef.current.has(id)) return

    // Cache miss — fetch and store (called directly, never inside a setState updater)
    getChapterAction(item.chapterId!).then(result => {
      if (result.success) {
        setChapterCache(c => new Map(c).set(id, result.data))
      } else {
        pushError(`Couldn't load chapter: ${result.error}`)
      }
    })
  }, [binderItems, pushError, flushPendingSave])

  const addBinderItem = useCallback((item: BinderItemRow) => {
    setBinderItems(prev => [...prev, item])
  }, [])

  const updateBinderItem = useCallback((id: string, patch: Partial<BinderItemRow>) => {
    setBinderItems(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
  }, [])

  const removeBinderItem = useCallback((id: string) => {
    setBinderItems(prev => prev.filter(x => x.id !== id))
  }, [])

  const updateChapterContent = useCallback((content: unknown) => {
    setSaveStatus('unsaved')

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    const targetItemId = activeItemId
    if (!targetItemId) return

    pendingSaveRef.current = { itemId: targetItemId, content }

    saveTimerRef.current = setTimeout(async () => {
      const pending = pendingSaveRef.current
      if (!pending) return
      pendingSaveRef.current = null
      await performSave(pending.itemId, pending.content)
    }, 2000)
  }, [activeItemId, performSave])

  const updateChapterStatus = useCallback(async (status: ChapterData['status']) => {
    if (!activeItemId) return

    const previous = chapterCache.get(activeItemId)
    if (!previous) return

    // Optimistic update
    setChapterCache(prev => {
      const m = new Map(prev)
      const ch = m.get(activeItemId)
      if (ch) m.set(activeItemId, { ...ch, status })
      return m
    })

    const result = await updateChapterStatusAction(previous.id, status)
    if (!result.success) {
      // Rollback
      setChapterCache(prev => {
        const m = new Map(prev)
        const ch = m.get(activeItemId)
        if (ch) m.set(activeItemId, { ...ch, status: previous.status })
        return m
      })
      pushError(`Couldn't update status: ${result.error}`)
    }
  }, [activeItemId, chapterCache, pushError])

  const updateChapterNotes = useCallback((notes: string | null) => {
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)

    const targetItemId = activeItemId

    notesTimerRef.current = setTimeout(async () => {
      const cachedChapter = targetItemId
        ? (chapterCacheRef.current.get(targetItemId) ?? null)
        : null

      if (!cachedChapter) return

      const result = await updateChapterNotesAction(cachedChapter.id, notes)
      if (!result.success) {
        pushError("Couldn't save notes. Please try again.")
      }
    }, 2000)
  }, [activeItemId, pushError])

  const dismissError = useCallback((index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Save-on-unload safety net: if there's a pending save when the user closes
  // the tab, fire it via sendBeacon (the only API that reliably completes
  // during unload) AND show the browser's native "Leave site?" prompt.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const pending = pendingSaveRef.current
      if (!pending) return

      const chapterId = chapterCacheRef.current.get(pending.itemId)?.id
      if (!chapterId) return

      const blob = new Blob(
        [JSON.stringify({ chapterId, content: pending.content })],
        { type: 'application/json' },
      )
      navigator.sendBeacon('/api/chapter-save-beacon', blob)

      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const activeItem = useMemo(
    () => binderItems.find(x => x.id === activeItemId) ?? null,
    [binderItems, activeItemId],
  )

  const activeChapter = useMemo(() => {
    if (!activeItemId || !activeItem || !CHAPTER_TYPES.has(activeItem.type)) return null
    return chapterCache.get(activeItemId) ?? null
  }, [activeItemId, activeItem, chapterCache])

  const value = useMemo<BookEditorContextValue>(() => ({
    bookId,
    bookTitle,
    locale,
    binderItems,
    activeItemId,
    activeItem,
    activeChapter,
    saveStatus,
    wordCount,
    errors,
    flashes,
    pushFlash,
    setActiveItemId,
    addBinderItem,
    updateBinderItem,
    removeBinderItem,
    setBinderItems,
    updateChapterContent,
    flushPendingSave,
    updateChapterStatus,
    updateChapterNotes,
    dismissError,
    focusMode,
    toggleFocusMode,
    corkboardMode,
    toggleCorkboardMode,
  }), [
    bookId,
    bookTitle,
    locale,
    binderItems,
    activeItemId,
    activeItem,
    activeChapter,
    saveStatus,
    wordCount,
    errors,
    flashes,
    pushFlash,
    setActiveItemId,
    addBinderItem,
    updateBinderItem,
    removeBinderItem,
    setBinderItems,
    updateChapterContent,
    flushPendingSave,
    updateChapterStatus,
    updateChapterNotes,
    dismissError,
    focusMode,
    toggleFocusMode,
    corkboardMode,
    toggleCorkboardMode,
  ])

  return <BookEditorContext.Provider value={value}>{children}</BookEditorContext.Provider>
}
