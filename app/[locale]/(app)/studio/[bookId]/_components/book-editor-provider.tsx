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
  setLiveWordCount: (n: number) => void
  updateChapterContent: (content: unknown) => void
  flushPendingSave: () => Promise<void>
  updateChapterStatus: (status: ChapterData['status']) => Promise<void>
  updateChapterNotes: (notes: string | null) => void
  dismissError: (index: number) => void
  focusMode: boolean
  toggleFocusMode: () => void
  pendingRenameId: string | null
  setPendingRenameId: (id: string | null) => void
  editorTheme: 'dark' | 'light'
  toggleEditorTheme: () => void
  historyOpen: boolean
  toggleHistory: () => void
  previewSnapshotId: string | null
  previewSnapshotContent: unknown
  previewSnapshotCreatedAt: Date | null
  enterPreview: (snapshot: { id: string; content: unknown; createdAt: Date }) => void
  exitPreview: () => void
  reloadActiveChapter: () => Promise<void>
  bookOverflow: boolean
  bookHive: { hiveId: string } | null
  currentUserId: string | null
  chapterContentVersion: number
  bumpChapterContentVersion: () => void
  gutterOpen: boolean
  toggleGutter: () => void
  liveCollabCounts: { annotations: number; suggestions: number } | null
  setLiveCollabCounts: (
    counts: { annotations: number; suggestions: number } | null,
  ) => void
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
  bookOverflow?: boolean
  bookHive?: { hiveId: string } | null
  currentUserId?: string | null
  children: React.ReactNode
}

export function BookEditorProvider({ bookId, bookTitle, locale, initialBinderItems, bookOverflow = false, bookHive = null, currentUserId = null, children }: Props) {
  const [binderItems, setBinderItems] = useState<BinderItemRow[]>(initialBinderItems)
  const [activeItemId, setActiveItemIdState] = useState<string | null>(null)
  const [chapterCache, setChapterCache] = useState<Map<string, ChapterData>>(new Map())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [wordCount, setWordCount] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [focusMode, setFocusMode] = useState(false)
  const toggleFocusMode = useCallback(() => setFocusMode(f => !f), [])
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null)
  const [editorTheme, setEditorTheme] = useState<'dark' | 'light'>(() => {
    // Light is the default writing surface (cream paper). Users opt into dark
    // via the toolbar Moon icon; preference persists per device in localStorage.
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('editor-theme') === 'dark' ? 'dark' : 'light'
  })

  const [historyOpen, setHistoryOpen] = useState(false)
  const [gutterOpen, setGutterOpen] = useState(false)
  const [chapterContentVersion, setChapterContentVersion] = useState(0)
  // Live unresolved counts fed by the CollaborationGutter for the active
  // chapter. Null when the gutter hasn't reported yet (toolbar falls back to
  // the server-fetched chapter counts in that window). Updates here drive
  // the toolbar's collab-gutter badge so it reflects post-resolve state.
  const [liveCollabCounts, setLiveCollabCounts] = useState<{
    annotations: number
    suggestions: number
  } | null>(null)
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null)
  const [previewSnapshotContent, setPreviewSnapshotContent] = useState<unknown>(null)
  const [previewSnapshotCreatedAt, setPreviewSnapshotCreatedAt] = useState<Date | null>(null)

  const toggleHistory = useCallback(() => {
    setHistoryOpen(o => {
      const next = !o
      if (next) setGutterOpen(false)
      return next
    })
  }, [])

  const toggleGutter = useCallback(() => {
    setGutterOpen(o => {
      const next = !o
      if (next) setHistoryOpen(false)
      return next
    })
  }, [])

  const bumpChapterContentVersion = useCallback(() => {
    setChapterContentVersion(v => v + 1)
  }, [])

  const enterPreview = useCallback((snapshot: {
    id: string
    content: unknown
    createdAt: Date
  }) => {
    setPreviewSnapshotId(snapshot.id)
    setPreviewSnapshotContent(snapshot.content)
    setPreviewSnapshotCreatedAt(snapshot.createdAt)
  }, [])

  const exitPreview = useCallback(() => {
    setPreviewSnapshotId(null)
    setPreviewSnapshotContent(null)
    setPreviewSnapshotCreatedAt(null)
  }, [])

  const toggleEditorTheme = useCallback(() => {
    setEditorTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      if (typeof window !== 'undefined') {
        localStorage.setItem('editor-theme', next)
      }
      return next
    })
  }, [])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ itemId: string; content: unknown } | null>(null)
  // Mirror of chapterCache for synchronous reads without triggering setState
  const chapterCacheRef = useRef(chapterCache)
  chapterCacheRef.current = chapterCache

  // Mirror of binderItems for synchronous reads in callbacks. Required because
  // `setActiveItemId` is called immediately after `addBinderItem` from the
  // Add menu (same tick) — the closure over `binderItems` is stale at that
  // moment and the item lookup would otherwise silently bail. The ref lets
  // callbacks read the freshest array without re-creating themselves on every
  // binderItems change.
  const binderItemsRef = useRef(binderItems)
  binderItemsRef.current = binderItems

  // Tracks the last item id we auto-opened the gutter for. Prevents re-opening
  // when the user manually closes it and a re-render happens for the same
  // chapter. React 19 strict-mode also double-invokes effects in dev, so
  // without the ref guard the auto-open would fire twice on first mount.
  const autoOpenedForItemRef = useRef<string | null>(null)

  function maybeAutoOpenGutter(_itemId: string, _data: ChapterData) {
    // Auto-open disabled per UX feedback — chapters open with the gutter
    // closed by default. The toolbar's pending-count badge is the surface
    // for "you have unresolved collab items"; user opens it when ready.
    return
  }

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

    // Next.js's RSC Flight serializer chokes on ProseMirror's mark attrs
    // objects (they're created with a non-standard prototype that the
    // serializer doesn't preserve member properties of). Deep-clone via JSON
    // round-trip so we ship plain prototype-less objects across the
    // server-action boundary.
    const plainContent = JSON.parse(JSON.stringify(content)) as unknown
    const result = await saveChapterAction(cachedChapter.id, plainContent)
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

    // Exit any active snapshot preview — switching items always returns to live.
    setPreviewSnapshotId(null)
    setPreviewSnapshotContent(null)
    setPreviewSnapshotCreatedAt(null)

    // Drop stale live collab counts; the gutter on the new chapter will report
    // its own once useCollabData resolves. Toolbar falls back to the chapter's
    // server-fetched counts in the meantime.
    setLiveCollabCounts(null)

    if (id === null) {
      setActiveItemIdState(null)
      setWordCount(0)
      return
    }

    // Read from the ref so this callback works even when invoked in the same
    // tick as `addBinderItem` (the closure over `binderItems` would be stale).
    const item = binderItemsRef.current.find(x => x.id === id)

    // Always set the active id, even if the item isn't in the ref yet (rare
    // ordering edge case). The downstream renderers handle a missing item
    // gracefully; the worst case is one render with empty state before the
    // ref catches up, vs the previous bug which left activeItemId frozen
    // forever and silently routed edits to the previous chapter.
    setActiveItemIdState(id)

    if (!item || !CHAPTER_TYPES.has(item.type)) {
      setWordCount(0)
      return
    }

    // Cache hit — seed word count from cache; live updates take over on type
    const cached = chapterCacheRef.current.get(id)
    if (cached) {
      setWordCount(cached.wordCount)
      setLiveCollabCounts({
        annotations: cached.annotationCount,
        suggestions: cached.pendingSuggestionCount,
      })
      maybeAutoOpenGutter(id, cached)
      return
    }

    // Cache miss — fetch and store (called directly, never inside a setState updater)
    getChapterAction(item.chapterId!).then(result => {
      if (result.success) {
        setChapterCache(c => new Map(c).set(id, result.data))
        setWordCount(result.data.wordCount)
        setLiveCollabCounts({
          annotations: result.data.annotationCount,
          suggestions: result.data.pendingSuggestionCount,
        })
        maybeAutoOpenGutter(id, result.data)
      } else {
        pushError(`Couldn't load chapter: ${result.error}`)
      }
    })
  }, [pushError, flushPendingSave])

  const addBinderItem = useCallback((item: BinderItemRow) => {
    // Sync ref update so a `setActiveItemId(item.id)` call in the same tick
    // (the create-and-open path in BinderAddMenu + EmptyStartChapter) can
    // resolve the item immediately and kick off the chapter fetch. Without
    // this, the ref only updates on the next render commit, the lookup
    // misses, and chapter creations get stuck on the loading skeleton until
    // a page refresh.
    binderItemsRef.current = [...binderItemsRef.current, item]
    setBinderItems(prev => [...prev, item])
  }, [])

  const updateBinderItem = useCallback((id: string, patch: Partial<BinderItemRow>) => {
    setBinderItems(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
  }, [])

  const removeBinderItem = useCallback((id: string) => {
    setBinderItems(prev => prev.filter(x => x.id !== id))
  }, [])

  const updateChapterContent = useCallback((content: unknown) => {
    // While a snapshot is being previewed, ignore all content updates —
    // TipTap's onUpdate still fires from programmatic setContent calls,
    // and we must not let snapshot content overwrite the live draft.
    if (previewSnapshotId !== null) return

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
  }, [activeItemId, performSave, previewSnapshotId])

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
    setBinderItems(prev =>
      prev.map(i => (i.id === activeItemId ? { ...i, chapterStatus: status } : i)),
    )

    const result = await updateChapterStatusAction(previous.id, status)
    if (!result.success) {
      // Rollback
      setChapterCache(prev => {
        const m = new Map(prev)
        const ch = m.get(activeItemId)
        if (ch) m.set(activeItemId, { ...ch, status: previous.status })
        return m
      })
      setBinderItems(prev =>
        prev.map(i =>
          i.id === activeItemId ? { ...i, chapterStatus: previous.status } : i,
        ),
      )
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

  const reloadActiveChapter = useCallback(async () => {
    const itemId = activeItemId
    if (!itemId) return
    const item = binderItems.find(x => x.id === itemId)
    if (!item || !CHAPTER_TYPES.has(item.type) || !item.chapterId) return
    const result = await getChapterAction(item.chapterId)
    if (result.success) {
      setChapterCache(c => new Map(c).set(itemId, result.data))
      setLiveCollabCounts({
        annotations: result.data.annotationCount,
        suggestions: result.data.pendingSuggestionCount,
      })
      maybeAutoOpenGutter(itemId, result.data)
    } else {
      pushError(`Couldn't reload chapter: ${result.error}`)
    }
  }, [activeItemId, binderItems, pushError])

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
    setLiveWordCount: setWordCount,
    updateChapterContent,
    flushPendingSave,
    updateChapterStatus,
    updateChapterNotes,
    dismissError,
    focusMode,
    toggleFocusMode,
    pendingRenameId,
    setPendingRenameId,
    editorTheme,
    toggleEditorTheme,
    historyOpen,
    toggleHistory,
    previewSnapshotId,
    previewSnapshotContent,
    previewSnapshotCreatedAt,
    enterPreview,
    exitPreview,
    reloadActiveChapter,
    bookOverflow,
    bookHive,
    currentUserId,
    chapterContentVersion,
    bumpChapterContentVersion,
    gutterOpen,
    toggleGutter,
    liveCollabCounts,
    setLiveCollabCounts,
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
    pendingRenameId,
    editorTheme,
    toggleEditorTheme,
    historyOpen,
    toggleHistory,
    previewSnapshotId,
    previewSnapshotContent,
    previewSnapshotCreatedAt,
    enterPreview,
    exitPreview,
    reloadActiveChapter,
    bookOverflow,
    bookHive,
    currentUserId,
    chapterContentVersion,
    bumpChapterContentVersion,
    gutterOpen,
    toggleGutter,
    liveCollabCounts,
  ])

  return <BookEditorContext.Provider value={value}>{children}</BookEditorContext.Provider>
}
