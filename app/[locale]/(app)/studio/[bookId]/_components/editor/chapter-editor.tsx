'use client'

import { useRef, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import { HiveAnnotationMark } from '@/lib/tiptap-extensions/hive-annotation-mark'
import { HiveSuggestionMark } from '@/lib/tiptap-extensions/hive-suggestion-mark'
import { FontSizeMark } from '@/lib/tiptap-extensions/font-size'
import { SelectionPopover } from '@/components/hive/collab/selection-popover'
import { CollaborationGutter } from '@/components/hive/collab/collaboration-gutter'
import { useBookEditor } from '../book-editor-provider'
import { EditorToolbar } from './editor-toolbar'
import { WritingAnalysis, extractPlainText } from './writing-analysis'
import { UpgradePrompt } from '@/components/upgrade/upgrade-prompt'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import { FindReplace } from './find-replace'
import { PreviewBanner } from './preview-banner'
import { OverflowBanner } from '../overflow-banner'
import { KeyboardCheatsheet } from './keyboard-cheatsheet'
import { CharacterProfile } from './character-profile'
import { WikiEntryEditor } from './wiki-entry-editor'
import { WikiFolderRenderer } from './wiki-folder-renderer'
import { ContainerView } from './container-view'
import { FrontBackMatterRenderer, shouldUseFrontBackMatterRenderer } from '../front-back-matter'
import { OutlineBoard } from '../outline/outline-board'
import { NoteEditor } from '../notes/note-editor'
import { EmptyState } from '../empty-state'
import { BookOpen } from 'lucide-react'

const CHAPTER_TYPES = new Set(['chapter', 'front_matter', 'back_matter'])

function EmptyStartChapter() {
  const { bookId, binderItems, addBinderItem, setActiveItemId, setPendingRenameId } = useBookEditor()
  const [creating, setCreating] = useState(false)

  // A book is "empty" if it has no editable-prose items (chapter, front_matter, back_matter).
  const hasAnyChapters = binderItems.some(i =>
    i.type === 'chapter' || i.type === 'front_matter' || i.type === 'back_matter'
  )

  async function createFirstChapter() {
    if (creating) return
    setCreating(true)
    const rootItems = binderItems.filter(i => i.parentId === null)
    const order = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) + 1 : 0
    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type: 'chapter',
      title: 'Untitled Chapter',
      order,
    })
    setCreating(false)
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type: 'chapter',
        title: 'Untitled Chapter',
        order,
        content: null,
        authorId: null,
        lastEditedBy: null,
        chapterId: result.data.chapterId,
        chapterStatus: result.data.chapterId ? 'FIRST_DRAFT' : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      setActiveItemId(result.data.id)
      setPendingRenameId(result.data.id)
    }
  }

  if (hasAnyChapters) {
    return (
      <main className="flex-1 flex">
        <EmptyState
          title="Select a chapter to write"
          body={
            <>
              Pick a chapter from the binder on the left, or click{' '}
              <span className="text-brand font-semibold">+ Add</span> to create a new one.
            </>
          }
          onEditorCanvas
        />
      </main>
    )
  }

  return (
    <main className="flex-1 flex">
      <EmptyState
        icon={<BookOpen size={20} />}
        title="Start your first chapter"
        body="Your binder is empty. Create a chapter. You can rename it anytime."
        cta={{
          label: creating ? 'Creating…' : '+ Start your first chapter',
          onClick: createFirstChapter,
          disabled: creating,
        }}
        onEditorCanvas
      />
    </main>
  )
}

export function ChapterEditor() {
  const {
    activeItemId,
    activeItem,
    activeChapter,
    updateChapterContent,
    flushPendingSave,
    previewSnapshotId,
    previewSnapshotContent,
    bookOverflow,
    bookHive,
    currentUserId,
    chapterContentVersion,
    bumpChapterContentVersion,
    gutterOpen,
    reloadActiveChapter,
    editorTheme,
    setLiveWordCount,
    setLiveCollabCounts,
    isPremium,
    locale,
  } = useBookEditor()

  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [editorText, setEditorText] = useState('')
  // Bumped after annotation/suggestion creation so the CollaborationGutter's
  // useCollabData hook re-fetches and the new row appears immediately. The
  // hive chapter view passes router.refresh() for this; the studio editor uses
  // a local nonce because there's no route-level refresh to lean on.
  const [collabRefreshNonce, setCollabRefreshNonce] = useState(0)
  const bumpCollabRefresh = () => setCollabRefreshNonce((n) => n + 1)
  // Used by the Cmd+F/Cmd+S keydown handler to scope shortcuts to focus
  // inside the editor (or on document.body when user is between actions).
  // Without the guard, typing in a metadata-panel textarea + Cmd+F would
  // intercept the browser's native Find and toggle the editor's find panel.
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const isChapterType = activeItem ? CHAPTER_TYPES.has(activeItem.type) : false

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: 'end',
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Start writing…' }),
        Underline,
        Highlight.configure({ multicolor: false }),
        Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-brand underline cursor-pointer' } }),
        Typography,
        CharacterCount,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        FontSizeMark,
        HiveAnnotationMark,
        HiveSuggestionMark,
      ],
      content: activeChapter?.content ?? null,
      onUpdate: ({ editor }) => {
        const json = editor.getJSON()
        updateChapterContent(json)
        setEditorText(extractPlainText(json))
        const cc = editor.storage.characterCount as { words?: () => number } | undefined
        if (cc?.words) setLiveWordCount(cc.words())
      },
      editorProps: {
        attributes: {
          class: 'outline-none min-h-full',
        },
      },
    },
    [activeItemId, chapterContentVersion],
  )

  // Keyboard shortcuts: Cmd/Ctrl+F (find), Cmd/Ctrl+S (force save).
  // Scoped: only fire when focus is inside the editor container OR on
  // document.body (which means no input is focused — user is between
  // actions and global editor shortcuts are still appropriate). Activity
  // inside the metadata-panel textareas is ignored.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return

      const active = document.activeElement
      const inEditor = editorContainerRef.current?.contains(active) ?? false
      const onBody = active === document.body || active === null
      if (!inEditor && !onBody) return

      if (e.key === 'f' && editor && !editor.isDestroyed) {
        e.preventDefault()
        setFindOpen(f => !f)
        return
      }

      if (e.key === 's' && editor && !editor.isDestroyed) {
        e.preventDefault()
        const json = editor.getJSON()
        updateChapterContent(json)
        const label = activeItem?.title ?? 'chapter'
        void flushPendingSave().then(() => {
          const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          toast.success(`Saved ${label}`, { description: stamp })
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor, updateChapterContent, flushPendingSave, activeItem])

  // When chapter data arrives after the async fetch, populate the editor.
  // useEditor initializes with null because activeChapter is always null on first render.
  // editor.isDestroyed guard handles React 19 strict-mode's unmount/remount
  // simulation: the effect can re-run with an editor whose internal view was
  // destroyed by the simulated unmount. Accessing editor.commands on a
  // destroyed editor throws "Cannot read properties of null (reading 'commands')".
  useEffect(() => {
    if (!editor || editor.isDestroyed || !activeChapter || !editor.isEmpty) return
    editor.commands.setContent(
      activeChapter.content as Parameters<typeof editor.commands.setContent>[0],
      { emitUpdate: false },
    )
    // Defer focus past the DOM update from setContent — calling focus()
    // synchronously inside the same tick is unreliable in React 19 + TipTap.
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return
      editor.commands.focus('end')
    })
    setEditorText(extractPlainText(activeChapter.content))
  }, [activeChapter, editor])

  // Preview-mode content swap. When previewSnapshotId becomes non-null,
  // load the snapshot content into the editor and mark it read-only. When
  // it returns to null AND we were just previewing, restore live content.
  // We track `wasPreviewing` in a ref so the live restore only runs on the
  // exit transition (not on every render where preview is null — that
  // would clobber the user's typing).
  const wasPreviewingRef = useRef(false)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (previewSnapshotId && previewSnapshotContent !== null) {
      editor.commands.setContent(
        previewSnapshotContent as Parameters<typeof editor.commands.setContent>[0],
        { emitUpdate: false },
      )
      // emitUpdate=false: setEditable defaults to firing the editor's `update`
      // event, which would trip our onUpdate handler and queue a stale save
      // (see overflow effect note below).
      editor.setEditable(false, false)
      wasPreviewingRef.current = true
    } else if (wasPreviewingRef.current) {
      // Exiting preview — restore live content from activeChapter.
      if (activeChapter) {
        editor.commands.setContent(
          activeChapter.content as Parameters<typeof editor.commands.setContent>[0],
          { emitUpdate: false },
        )
      }
      editor.setEditable(true, false)
      wasPreviewingRef.current = false
    }
  }, [previewSnapshotId, previewSnapshotContent, activeChapter, editor])

  // Read-only when this book is in free-tier overflow. Skipped while a snapshot
  // preview is active (that effect already owns setEditable in that mode and
  // exits cleanly when preview ends).
  //
  // emitUpdate=false: TipTap's setEditable defaults to firing the editor's
  // `update` event, which would trip our onUpdate handler and queue a save
  // of the editor's CURRENT content. This effect runs on every editor
  // re-creation (the `editor` dep flips when useEditor rebuilds on chapter
  // switch). On a cache-miss switch the editor is briefly empty before the
  // setContent effect loads cached content — without this guard, that brief
  // empty state would be debounce-saved over the real content. Symptom: a
  // wave of 0-word snapshots on every chapter navigation.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (previewSnapshotId) return
    editor.setEditable(!bookOverflow, false)
  }, [bookOverflow, editor, previewSnapshotId])

  if (activeItemId === null) {
    return <EmptyStartChapter />
  }

  if (activeItem && shouldUseFrontBackMatterRenderer(activeItem)) {
    return <FrontBackMatterRenderer item={activeItem} />
  }

  if (activeItem && !isChapterType) {
    if (activeItem.type === 'outline') {
      return <OutlineBoard item={activeItem} />
    }
    if (activeItem.type === 'research_note') {
      return <NoteEditor item={activeItem} />
    }
    if (activeItem.type === 'character') {
      return <CharacterProfile item={activeItem} />
    }
    if (activeItem.type === 'wiki_entry') {
      return <WikiEntryEditor item={activeItem} />
    }
    if (activeItem.type === 'wiki_folder') {
      return <WikiFolderRenderer item={activeItem} />
    }
    if (activeItem.type === 'part' || activeItem.type === 'research_folder') {
      return <ContainerView item={activeItem} />
    }
    // All known non-chapter types are routed above. If we hit this in dev,
    // log a warning; in prod, render nothing (silent fallback).
    if (process.env.NODE_ENV !== 'production') {
      console.warn('No specialized renderer for binder item type:', activeItem.type)
    }
    return null
  }

  if (activeChapter === null) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 border-b border-border bg-surface animate-pulse" />
        <div className="flex-1 p-8 space-y-3">
          <div className="h-4 bg-surface rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-surface rounded w-full animate-pulse" />
          <div className="h-4 bg-surface rounded w-5/6 animate-pulse" />
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      {bookOverflow && <OverflowBanner />}
      {editor && (
        <EditorToolbar
          editor={editor}
          onToggleAnalysis={() => setAnalysisOpen(a => !a)}
          analysisOpen={analysisOpen}
          onToggleFind={() => setFindOpen(f => !f)}
          findOpen={findOpen}
        />
      )}
      <PreviewBanner />
      {findOpen && editor && <FindReplace editor={editor} onClose={() => setFindOpen(false)} />}
      {editor && bookHive && isChapterType && activeChapter && currentUserId && (
        <SelectionPopover
          editor={editor}
          hiveId={bookHive.hiveId}
          chapterId={activeChapter.id}
          canAnnotate
          canSuggestEdits
          flushPendingSave={flushPendingSave}
          onAnnotationCreated={bumpCollabRefresh}
          onSuggestionCreated={bumpCollabRefresh}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={editorContainerRef}
          className="flex-1 overflow-y-auto cursor-text"
          style={
            editorTheme === 'dark'
              ? {
                  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
                  borderRadius: 'var(--r-card)',
                  boxShadow: 'var(--sh-card)',
                  border: 'var(--br-card)',
                }
              : undefined
          }
          onClick={() => {
            if (editor && !editor.isDestroyed) editor.commands.focus()
          }}
        >
          <EditorContent
            editor={editor}
            className="min-h-full mx-auto focus:outline-none"
            style={{
              fontFamily: 'var(--font-prose)',
              fontSize: 'var(--editor-font-size, 18px)',
              lineHeight: 'var(--editor-line-height, 1.78)',
              maxWidth: 'var(--prose-max, 720px)',
              padding: '64px 56px 96px',
            }}
          />
        </div>
        {gutterOpen && bookHive && isChapterType && activeChapter && currentUserId && (
          // Mounted here (not via RightPanelSlot) because the gutter needs the
          // live TipTap editor instance for coordsAtPos anchoring. The studio
          // editor is author-only access, so viewer is treated as OWNER with
          // bookOwnerId == currentUserId.
          <CollaborationGutter
            editor={editor}
            chapterId={activeChapter.id}
            hiveId={bookHive.hiveId}
            viewer={{ id: currentUserId, role: 'OWNER', bookOwnerId: currentUserId }}
            refreshTrigger={collabRefreshNonce}
            onAcceptedSuggestion={() => {
              void reloadActiveChapter().then(() => bumpChapterContentVersion())
            }}
            flushPendingSave={flushPendingSave}
            onMutated={() => {
              bumpCollabRefresh()
              // The gutter's wrappedMutate already refreshed its useCollabData
              // and onCountsChange fired; also reload the chapter so its
              // cached annotationCount/pendingSuggestionCount stay accurate
              // for the next time the gutter remounts.
              void reloadActiveChapter()
            }}
            onCountsChange={setLiveCollabCounts}
          />
        )}
        {analysisOpen &&
          (isPremium ? (
            <WritingAnalysis
              editorText={editorText}
              isOpen={analysisOpen}
              onClose={() => setAnalysisOpen(false)}
            />
          ) : (
            <div className="p-4">
              <UpgradePrompt feature="writing-analysis" locale={locale} isAuthed />
            </div>
          ))}
      </div>
      <KeyboardCheatsheet />
    </main>
  )
}
