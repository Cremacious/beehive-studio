'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import type { CharacterCountStorage } from '@tiptap/extensions'
import { useBookEditor } from '../book-editor-provider'
import { EditorToolbar } from './editor-toolbar'
import { SprintTimer } from './sprint-timer'
import { AmbientSounds } from './ambient-sounds'
import { WritingAnalysis, extractPlainText } from './writing-analysis'
import { updateBinderItemAction, createBinderItemAction } from '@/lib/actions/binder.actions'
import { FindReplace } from './find-replace'
import { CharacterProfile } from './character-profile'
import { FrontBackMatterRenderer, shouldUseFrontBackMatterRenderer } from '../front-back-matter'

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
        chapterId: result.data.chapterId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      setActiveItemId(result.data.id)
      setPendingRenameId(result.data.id)
    }
  }

  if (hasAnyChapters) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center flex flex-col items-center gap-2">
          <h1 className="text-lg font-medium text-foreground/80">Select a chapter to write</h1>
          <p className="text-sm text-muted-foreground">
            Pick a chapter from the binder on the left, or click <span className="text-brand font-semibold">+ Add</span> to create a new one.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold font-comfortaa text-foreground">Start your first chapter</h1>
        <p className="text-sm text-muted-foreground">
          Your binder is empty. Create a chapter — you can rename it anytime.
        </p>
        <button
          onClick={createFirstChapter}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-md bg-brand hover:bg-brand-hover px-4 py-2 text-sm font-semibold text-background transition-colors shadow-sm disabled:opacity-50"
        >
          <span className="text-base leading-none">+</span>
          <span>{creating ? 'Creating…' : 'Start your first chapter'}</span>
        </button>
      </div>
    </main>
  )
}

export function ChapterEditor() {
  const { activeItemId, activeItem, activeChapter, updateChapterContent, updateBinderItem, wordCount, flushPendingSave, pushFlash } =
    useBookEditor()

  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [soundsOpen, setSoundsOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [editorText, setEditorText] = useState('')

  const researchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleResearchChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      if (researchTimerRef.current) clearTimeout(researchTimerRef.current)
      researchTimerRef.current = setTimeout(async () => {
        if (!activeItem) return
        await updateBinderItemAction(activeItem.id, { content: value })
        updateBinderItem(activeItem.id, { content: value })
      }, 2000)
    },
    [activeItem, updateBinderItem],
  )

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
      ],
      content: activeChapter?.content ?? null,
      onUpdate: ({ editor }) => {
        updateChapterContent(editor.getJSON())
        setEditorText(extractPlainText(editor.getJSON()))
      },
      editorProps: {
        attributes: {
          class: 'outline-none min-h-full',
        },
      },
    },
    [activeItemId],
  )

  // Keyboard shortcuts: Cmd/Ctrl+F (find), Cmd/Ctrl+S (force save)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key === 'f' && editor) {
        e.preventDefault()
        setFindOpen(f => !f)
        return
      }

      if (e.key === 's' && editor) {
        e.preventDefault()
        const json = editor.getJSON()
        updateChapterContent(json)
        void flushPendingSave().then(() => pushFlash('Saved'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor, updateChapterContent, flushPendingSave, pushFlash])

  // When chapter data arrives after the async fetch, populate the editor.
  // useEditor initializes with null because activeChapter is always null on first render.
  useEffect(() => {
    if (!editor || !activeChapter || !editor.isEmpty) return
    editor.commands.setContent(
      activeChapter.content as Parameters<typeof editor.commands.setContent>[0],
      { emitUpdate: false },
    )
    // Defer focus past the DOM update from setContent — calling focus()
    // synchronously inside the same tick is unreliable in React 19 + TipTap.
    requestAnimationFrame(() => {
      editor.commands.focus('end')
    })
    setEditorText(extractPlainText(activeChapter.content))
  }, [activeChapter, editor])

  if (activeItemId === null) {
    return <EmptyStartChapter />
  }

  if (activeItem && shouldUseFrontBackMatterRenderer(activeItem)) {
    return <FrontBackMatterRenderer item={activeItem} />
  }

  if (activeItem && !isChapterType) {
    if (activeItem.type === 'character') {
      return <CharacterProfile item={activeItem} />
    }
    return (
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-foreground/70">{activeItem.title}</h2>
        </div>
        <textarea
          className="flex-1 resize-none bg-transparent text-sm text-foreground/80 p-6 outline-none leading-relaxed"
          placeholder="Start writing your notes..."
          defaultValue={typeof activeItem.content === 'string' ? activeItem.content : ''}
          onChange={handleResearchChange}
        />
      </main>
    )
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

  const charCount = editor?.storage.characterCount as CharacterCountStorage | undefined

  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      {editor && (
        <EditorToolbar
          editor={editor}
          onToggleAnalysis={() => setAnalysisOpen(a => !a)}
          analysisOpen={analysisOpen}
          onToggleSounds={() => setSoundsOpen(s => !s)}
          soundsOpen={soundsOpen}
          onToggleFind={() => setFindOpen(f => !f)}
          findOpen={findOpen}
        />
      )}
      {findOpen && editor && <FindReplace editor={editor} onClose={() => setFindOpen(false)} />}
      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex-1 overflow-y-auto cursor-text"
          onClick={() => editor?.commands.focus()}
        >
          <EditorContent
            editor={editor}
            className="min-h-full p-8 max-w-3xl mx-auto prose prose-invert prose-sm focus:outline-none"
            style={{
              fontSize: 'var(--editor-font-size, 16px)',
              lineHeight: '1.8',
            }}
          />
        </div>
        {analysisOpen && (
          <WritingAnalysis
            editorText={editorText}
            isOpen={analysisOpen}
            onClose={() => setAnalysisOpen(false)}
          />
        )}
      </div>
      <SprintTimer currentWordCount={charCount?.words() ?? wordCount} />
      {soundsOpen && <AmbientSounds onClose={() => setSoundsOpen(false)} />}
    </main>
  )
}
