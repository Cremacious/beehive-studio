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
import { EditorToolbar } from '../editor/editor-toolbar'
import { NoteAttributeControls } from './note-attribute-controls'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'

type Props = { item: BinderItemRow }

export function NoteEditor({ item }: Props) {
  const { updateBinderItem } = useBookEditor()

  const initial = normalizeNoteContent(item.content)
  const [pinned, setPinned] = useState(initial.pinned ?? false)
  const [color, setColor] = useState<NoteColor | null>(initial.color ?? null)
  const [favorited, setFavorited] = useState(initial.favorited ?? false)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const [bodyFocused, setBodyFocused] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const attrsRef = useRef({ pinned, color, favorited })
  attrsRef.current = { pinned, color, favorited }

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: 'end',
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Note to self. Jot anything down here…' }),
      ],
      content: initial.text as Parameters<typeof useEditor>[0]['content'],
      onUpdate: ({ editor }) => {
        scheduleSave(editor.getJSON())
      },
      onFocus() { setBodyFocused(true) },
      onBlur() { setBodyFocused(false) },
    },
    [item.id],
  )

  // Persist seed on first mount when content was null
  useEffect(() => {
    if (item.content === null || item.content === undefined) {
      const next: ResearchNoteContent = {
        text: initial.text,
        pinned: false,
        color: null,
        favorited: false,
      }
      void updateBinderItemAction(item.id, { content: next }).catch(() => {})
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
      try {
        const result = await updateBinderItemAction(item.id, { content: next })
        // Keep the user's note text on failure; just surface the error.
        setSaveStatus(result.success ? 'saved' : 'unsaved')
        if (!result.success) toastActionError(result.error)
      } catch {
        setSaveStatus('unsaved')
        toastNetworkError()
      }
    }, 2000)
  }

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
      data-body-focused={bodyFocused ? 'true' : 'false'}
      className="flex-1 flex flex-col overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
    >
      <style>{`
        /* ── DARK MODE (default) ── */
        [data-slot="note-editor"] {
          --note-ink:           var(--canvas-dark-ink-strong);
          --note-ink-strong:    var(--canvas-dark-ink-strong);
          --note-ink-muted:     var(--canvas-dark-ink);
          --note-ink-faint:     var(--canvas-dark-ink-faint);
          --note-body-bg:       linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300));
          --note-body-border-color: oklch(1 0 0 / 0.40);
          --note-body-shadow:   var(--sh-tile), inset 0 1px 0 oklch(1 0 0 / 0.04);
          --note-ring:          oklch(from var(--brand) l c h / 0.55);
          --note-strip-bg:      var(--canvas-dark-100);
          --note-strip-border:  oklch(1 0 0 / 0.06);
          /* Re-route paper-ink-* tokens so NoteAttributeControls (which references
             them inline) reads as dark-canvas text in dark mode without us
             needing to fork that component. */
          --paper-ink-strong:   var(--canvas-dark-ink-strong);
          --paper-ink:          var(--canvas-dark-ink);
          --paper-ink-muted:    var(--canvas-dark-ink);
          --paper-100:          var(--canvas-dark-350);
        }
        /* ── LIGHT MODE (cream paper) ── */
        [data-editor-theme="light"] [data-slot="note-editor"] {
          background: var(--paper-300) !important;
          --note-ink:           oklch(0.180 0.022 50);
          --note-ink-strong:    oklch(0.180 0.022 50);
          --note-ink-muted:     oklch(0.265 0.020 55);
          --note-ink-faint:     oklch(0.520 0.022 60);
          --note-body-bg:       var(--paper-50);
          --note-body-border-color: oklch(0 0 0 / 0.32);
          --note-body-shadow:   0 1px 0 var(--paper-200), 0 4px 12px -6px oklch(0 0 0 / 0.10);
          --note-ring:          oklch(from var(--brand) l c h / 0.5);
          /* Strip matches dark-mode design: dark canvas bar with light
             text — visually identical to dark mode's header strip. The
             .note-ink-muted class inside the strip reads --note-ink-muted
             which we override to a light canvas tone scoped to the strip
             via a child selector below. */
          --note-strip-bg:      var(--canvas-dark-100);
          --note-strip-border:  oklch(1 0 0 / 0.06);
          /* Restore paper-* ink tokens to native values — the dark-mode
             block above remaps them to light canvas colors; without this
             reset, NoteAttributeControls (and anything else reading
             --paper-ink-*) inherits the dark-mode override and renders
             white text on cream paper. */
          --paper-ink-strong:   oklch(0.180 0.022 50);
          --paper-ink:          oklch(0.265 0.020 55);
          --paper-ink-muted:    oklch(0.520 0.022 60);
          --paper-100:          oklch(0.965 0.018 85);
        }
        /* Strip itself stays dark in light mode (matches dark-mode design).
           Force ink tokens back to light canvas values within the strip so
           the "Research note" label and the SaveStatusBadge render as light
           text on the dark bar, exactly like dark mode. */
        [data-editor-theme="light"] [data-slot="note-editor"] [data-slot="note-strip"] {
          --note-ink:           var(--canvas-dark-ink-strong);
          --note-ink-strong:    var(--canvas-dark-ink-strong);
          --note-ink-muted:     var(--canvas-dark-ink);
          --note-ink-faint:     var(--canvas-dark-ink);
          --paper-ink-strong:   var(--canvas-dark-ink-strong);
          --paper-ink:          var(--canvas-dark-ink);
          --paper-ink-muted:    var(--canvas-dark-ink);
        }

        [data-slot="note-editor"] .note-ink         { color: var(--note-ink); }
        [data-slot="note-editor"] .note-ink-strong  { color: var(--note-ink-strong); }
        [data-slot="note-editor"] .note-ink-muted   { color: var(--note-ink-muted); }
        [data-slot="note-editor"] .note-ink-faint   { color: var(--note-ink-faint); }

        /* Body card */
        [data-slot="note-editor"] .note-body {
          background: var(--note-body-bg);
          box-shadow: var(--note-body-shadow);
          border-width: 1px;
          border-style: solid;
          border-color: var(--note-body-border-color);
          border-radius: 16px;
          transition: box-shadow 0.15s ease;
        }
        [data-slot="note-editor"][data-body-focused="true"] .note-body {
          box-shadow: var(--note-body-shadow), 0 0 0 2px var(--note-ring);
        }

        /* ProseMirror prose */
        [data-slot="note-editor"] .note-body .ProseMirror {
          color: var(--note-ink);
          caret-color: var(--brand);
          outline: none;
          min-height: 420px;
          font-family: var(--font-prose);
          font-size: 16px;
          line-height: 1.75;
        }
        [data-slot="note-editor"] .note-body .ProseMirror h1,
        [data-slot="note-editor"] .note-body .ProseMirror h2,
        [data-slot="note-editor"] .note-body .ProseMirror h3 {
          color: var(--note-ink-strong);
          font-family: var(--font-display);
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        [data-slot="note-editor"] .note-body .ProseMirror h1 { font-size: 24px; margin: 1.4em 0 0.5em; }
        [data-slot="note-editor"] .note-body .ProseMirror h2 { font-size: 20px; margin: 1.3em 0 0.45em; }
        [data-slot="note-editor"] .note-body .ProseMirror h3 { font-size: 17px; margin: 1.2em 0 0.4em; }
        [data-slot="note-editor"] .note-body .ProseMirror h1:first-child,
        [data-slot="note-editor"] .note-body .ProseMirror h2:first-child,
        [data-slot="note-editor"] .note-body .ProseMirror h3:first-child { margin-top: 0; }
        [data-slot="note-editor"] .note-body .ProseMirror strong { color: var(--note-ink-strong); font-weight: 600; }
        [data-slot="note-editor"] .note-body .ProseMirror em { font-style: italic; }
        [data-slot="note-editor"] .note-body .ProseMirror blockquote {
          color: var(--note-ink-muted);
          border-left: 3px solid oklch(from var(--brand) l c h / 0.55);
          padding-left: 0.9em;
          margin: 0.8em 0;
        }
        [data-slot="note-editor"] .note-body .ProseMirror p { margin: 0 0 0.95em; text-wrap: pretty; }
        [data-slot="note-editor"] .note-body .ProseMirror p:last-child { margin-bottom: 0; }
        [data-slot="note-editor"] .note-body .ProseMirror ul,
        [data-slot="note-editor"] .note-body .ProseMirror ol { padding-left: 1.4em; margin: 0 0 0.95em; }
        [data-slot="note-editor"] .note-body .ProseMirror ul { list-style: disc; }
        [data-slot="note-editor"] .note-body .ProseMirror ol { list-style: decimal; }
        [data-slot="note-editor"] .note-body .ProseMirror li { margin: 0.3em 0; }

        /* Placeholder */
        [data-slot="note-editor"] .note-body .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          font-style: italic;
          color: var(--note-ink-faint);
        }
      `}</style>

      {/* Toolbar — same as chapter editor (formatting buttons) */}
      {editor && <EditorToolbar editor={editor} />}

      {/* Breadcrumb + save status — sits below the toolbar */}
      <header
        data-slot="note-strip"
        className="flex items-center justify-between px-6 py-2.5"
        style={{
          background: 'var(--note-strip-bg)',
          borderBottom: '1px solid var(--note-strip-border)',
          boxShadow: 'inset 0 1px 2px oklch(0 0 0 / 0.18)',
        }}
      >
        <span className="note-ink-muted text-[10px] font-mono uppercase tracking-[0.10em] font-semibold inline-flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ backgroundColor: 'oklch(0.62 0.10 30)' }}
            aria-hidden
          />
          Research note
        </span>
        <SaveStatusBadge status={saveStatus} />
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[840px] px-8 py-8 space-y-6">
          {/* HERO — title + attribute strip (transparent) */}
          <section className="space-y-4">
            <h1
              className="text-center note-ink-strong leading-tight"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {item.title}
            </h1>
            <div className="flex justify-center">
              <NoteAttributeControls
                pinned={pinned}
                color={color}
                favorited={favorited}
                onPinChange={v => commitAttrs({ pinned: v })}
                onColorChange={v => commitAttrs({ color: v })}
                onFavoriteChange={v => commitAttrs({ favorited: v })}
              />
            </div>
          </section>

          {/* BODY — full-width raised tile (dark) / paper card (light) */}
          <section
            className="note-body px-7 py-7 cursor-text"
            onClick={() => {
              if (editor && !editor.isDestroyed) editor.commands.focus()
            }}
          >
            <EditorContent editor={editor} />
          </section>
        </div>
      </div>
    </main>
  )
}
