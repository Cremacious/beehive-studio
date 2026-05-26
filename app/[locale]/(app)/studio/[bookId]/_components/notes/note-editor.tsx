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
    <main
      data-slot="note-editor"
      className="flex-1 flex flex-col overflow-hidden"
    >
      {/* Paper-card prose overrides — beats globals.css's .ProseMirror dark-canvas
         palette so the note body reads on cream paper. Note cards are always
         paper regardless of editor theme (they represent a physical note). */}
      <style>{`
        [data-slot="note-card"] .ProseMirror { color: var(--paper-ink); caret-color: var(--color-brand); outline: none; }
        [data-slot="note-card"] .ProseMirror h1,
        [data-slot="note-card"] .ProseMirror h2,
        [data-slot="note-card"] .ProseMirror h3 { color: var(--paper-ink-strong); font-family: var(--font-display); }
        [data-slot="note-card"] .ProseMirror h2 { font-size: 18px; margin: 1.4em 0 0.4em; }
        [data-slot="note-card"] .ProseMirror strong { color: var(--paper-ink-strong); font-weight: 600; }
        [data-slot="note-card"] .ProseMirror em { font-style: italic; }
        [data-slot="note-card"] .ProseMirror blockquote { color: var(--paper-ink-muted); border-left: 3px solid oklch(0.78 0.04 60 / 0.45); padding-left: 0.9em; margin: 0.6em 0; }
        [data-slot="note-card"] .ProseMirror p { margin: 0 0 1em; text-wrap: pretty; }
        [data-slot="note-card"] .ProseMirror ul,
        [data-slot="note-card"] .ProseMirror ol { padding-left: 1.2em; margin: 0 0 1em; }
        [data-slot="note-card"] .ProseMirror li { margin: 0.3em 0; }
        [data-slot="note-card"] .ProseMirror p.is-editor-empty:first-child::before { color: var(--paper-ink-muted); }
      `}</style>
      {/* Surface header — breadcrumb + name + toolbar + save badge.
         Mirrors mockup §10's surface-head row. */}
      <header
        data-slot="note-surface-head"
        className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-surface"
      >
        <span
          className="inline-block w-2 h-2 rounded-sm"
          style={{ backgroundColor: 'oklch(0.62 0.10 30)' }}
          aria-hidden
        />
        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Research</span>
        <span className="text-sm font-medium text-foreground/90 truncate">{item.title}</span>
        <div className="flex-1" />
        <SaveStatusBadge status={saveStatus} />
      </header>

      {/* Note pane — softly tinted canvas, scrolls. */}
      <div
        data-slot="note-pane"
        className="flex-1 overflow-y-auto cursor-text"
        onClick={() => {
          if (editor && !editor.isDestroyed) editor.commands.focus()
        }}
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, oklch(0.85 0.18 90 / 0.04), transparent 50%), var(--background)',
        }}
      >
        <div className="flex flex-col items-center px-6 pt-9 pb-16">
          {/* Toolbar floats above the card, left-aligned to the card. */}
          <div className="w-full max-w-[600px] mb-3 flex justify-start">
            {editor && <NoteToolbar editor={editor} />}
          </div>

          {/* The note card — plain cream paper, no ruled lines. */}
          <article
            data-slot="note-card"
            className="relative w-full max-w-[600px] rounded-lg px-14 pt-8 pb-20"
            style={{
              background: 'var(--paper-100)',
              color: 'var(--paper-ink)',
              boxShadow:
                '0 1px 0 var(--paper-50) inset, 0 2px 6px rgba(0,0,0,0.3), 0 22px 60px -16px rgba(0,0,0,0.55)',
            }}
          >
            <h1
              data-slot="note-title"
              className="m-0 mb-1.5 leading-tight"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.015em',
                color: 'var(--paper-ink-strong)',
              }}
            >
              {item.title}
            </h1>
            <div
              data-slot="note-meta"
              className="mb-5"
              style={{
                fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--paper-ink-muted)',
              }}
            >
              Research note{pinned ? ' · Pinned' : ''}
            </div>

            {/* Attribute strip — beneath title, divider line below. */}
            <div
              data-slot="note-attrs-strip"
              className="flex items-center flex-wrap gap-2 pt-2 pb-4 mb-7"
              style={{ borderBottom: '1px solid oklch(0.78 0.04 60 / 0.40)' }}
            >
              <NoteAttributeControls
                pinned={pinned}
                color={color}
                favorited={favorited}
                onPinChange={v => commitAttrs({ pinned: v })}
                onColorChange={v => commitAttrs({ color: v })}
                onFavoriteChange={v => commitAttrs({ favorited: v })}
              />
            </div>

            {/* Note body — Newsreader prose. The legal-pad guides bleed through. */}
            <EditorContent
              editor={editor}
              data-slot="note-body"
              className="focus:outline-none"
              style={{
                fontFamily: 'var(--font-prose)',
                fontSize: '16.5px',
                lineHeight: 1.78,
                color: 'var(--paper-ink)',
              }}
            />
          </article>
        </div>
      </div>
    </main>
  )
}
