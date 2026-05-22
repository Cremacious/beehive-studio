'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { normalizeNoteContent, type NoteColor, type ResearchNoteContent } from '@/lib/notes/note-content'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { NoteToolbar } from './note-toolbar'
import { NoteAttributeControls } from './note-attribute-controls'

type Props = { item: BinderItemRow }

export function NoteEditor({ item }: Props) {
  const { updateBinderItem } = useBookEditor()

  // Normalize on mount; legacy string content becomes a structured object.
  const initial = normalizeNoteContent(item.content)
  const [pinned, setPinned] = useState(initial.pinned ?? false)
  const [color, setColor] = useState<NoteColor | null>(initial.color ?? null)
  const [favorited, setFavorited] = useState(initial.favorited ?? false)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep latest attribute values in refs so the save closure picks them up.
  const attrsRef = useRef({ pinned, color, favorited })
  attrsRef.current = { pinned, color, favorited }

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: 'end',
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Note to self…' }),
      ],
      // `unknown` cast — TipTap accepts JSONContent | string | null at runtime;
      // the normalizer returns `unknown` deliberately so we don't take a hard
      // dependency on TipTap's exported types in the helper module.
      content: initial.text as Parameters<typeof useEditor>[0]['content'],
      onUpdate: ({ editor }) => {
        scheduleSave(editor.getJSON())
      },
    },
    [item.id],
  )

  // Persist seed on first mount when content was null (so subsequent loads
  // skip the normalize-from-null path).
  useEffect(() => {
    if (item.content === null || item.content === undefined) {
      const next: ResearchNoteContent = {
        text: initial.text,
        pinned: false,
        color: null,
        favorited: false,
      }
      void updateBinderItemAction(item.id, { content: next })
      updateBinderItem(item.id, { content: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scheduleSave(textJSON: unknown) {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const next: ResearchNoteContent = {
        text: textJSON,
        ...attrsRef.current,
      }
      updateBinderItem(item.id, { content: next })
      const result = await updateBinderItemAction(item.id, { content: next })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  // Attribute changes: update state, then immediately schedule a save with
  // the current editor text + new attrs.
  function commitAttrs(partial: Partial<{ pinned: boolean; color: NoteColor | null; favorited: boolean }>) {
    if (partial.pinned !== undefined) setPinned(partial.pinned)
    if (partial.color !== undefined) setColor(partial.color)
    if (partial.favorited !== undefined) setFavorited(partial.favorited)
    attrsRef.current = { ...attrsRef.current, ...partial }
    const json = !editor || editor.isDestroyed ? initial.text : editor.getJSON()
    scheduleSave(json)
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
          <span className="text-[10px] text-muted-foreground">· Research note</span>
        </div>
        <div className="flex items-center gap-3">
          <NoteAttributeControls
            pinned={pinned}
            color={color}
            favorited={favorited}
            onPinChange={v => commitAttrs({ pinned: v })}
            onColorChange={v => commitAttrs({ color: v })}
            onFavoriteChange={v => commitAttrs({ favorited: v })}
          />
          <SaveStatusBadge status={saveStatus} />
        </div>
      </header>

      {editor && <NoteToolbar editor={editor} />}

      <div
        className="flex-1 overflow-y-auto cursor-text"
        onClick={() => {
          if (editor && !editor.isDestroyed) editor.commands.focus()
        }}
      >
        <EditorContent
          editor={editor}
          className="min-h-full p-6 max-w-2xl mx-auto prose prose-invert prose-sm focus:outline-none"
          style={{ fontSize: '15px', lineHeight: '1.7' }}
        />
      </div>
    </main>
  )
}
