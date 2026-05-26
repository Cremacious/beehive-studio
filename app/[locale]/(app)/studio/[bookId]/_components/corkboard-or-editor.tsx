'use client'

import { useBookEditor } from './book-editor-provider'
import { ChapterEditor } from './editor/chapter-editor'
import { CorkboardView } from './corkboard-view'

export function CorkboardOrEditor() {
  const { corkboardMode, editorTheme } = useBookEditor()
  // data-editor-theme lives on this wrapper so ALL editor render paths
  // (ChapterEditor's many early returns, CorkboardView, FrontBackMatter,
  // Outline, Note, etc.) inherit the attribute and get themed. Previously
  // the attribute was on chapter-editor.tsx's main, which only covered
  // the TipTap path — meaning toggling light/dark on a Front Matter form
  // (or Outline / Note / etc.) did nothing.
  // Light-mode for the editor area.
  // We tried scoped CSS rules in globals.css (`[data-editor-theme="light"]
  // .ProseMirror { color: ... }` etc.) but those weren't reaching the
  // descendants reliably — other rules in the same file work, so the cause
  // is unclear (maybe Tailwind v4 cascade-layer ordering vs unlayered
  // attribute selectors). Pragmatic fix: inline styles on the wrapper for
  // background + a React-injected <style> tag for the inner ProseMirror
  // prose colors. Bypasses the CSS-file pipeline entirely.
  const isLight = editorTheme === 'light'
  return (
    <div
      data-editor-theme={editorTheme}
      className="flex-1 flex flex-col overflow-hidden"
      style={isLight ? { backgroundColor: 'var(--paper-100)', color: 'var(--paper-ink-strong)' } : undefined}
    >
      {isLight && (
        <style>{`
          /* Toolbar */
          [data-editor-theme="light"] [data-slot="editor-toolbar"] {
            background-color: var(--paper-200);
            border-bottom-color: var(--paper-300);
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] button {
            color: var(--paper-ink-muted);
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] button:hover {
            color: var(--paper-ink-strong);
            background-color: var(--paper-200);
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] button:disabled {
            color: oklch(from var(--paper-ink) l c h / 0.3);
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] .bg-border {
            background-color: var(--paper-400);
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] select {
            background-color: var(--paper-50);
            border-color: var(--paper-400);
            color: var(--paper-ink-strong);
          }
          /* Bottom status bar */
          [data-editor-theme="light"] [data-slot="editor-status-bar"] {
            background-color: var(--paper-200);
            border-top-color: var(--paper-300);
            color: var(--paper-ink-muted);
          }
          [data-editor-theme="light"] [data-slot="editor-status-bar"] button {
            color: var(--paper-ink-muted);
          }
          [data-editor-theme="light"] [data-slot="editor-status-bar"] button:hover {
            color: var(--paper-ink-strong);
          }
          [data-editor-theme="light"] [data-slot="editor-status-bar"] input {
            background-color: var(--paper-50);
            border-color: var(--paper-400);
            color: var(--paper-ink-strong);
          }
          /* Sprint time runs one shade darker than muted in both modes. */
          [data-editor-theme="light"] [data-slot="sprint-time"] {
            color: var(--paper-ink) !important;
          }

          /* ProseMirror prose body — paper mode per mockup */
          [data-editor-theme="light"] .tiptap.ProseMirror { color: var(--paper-ink); caret-color: var(--color-brand); }
          [data-editor-theme="light"] .tiptap.ProseMirror h1,
          [data-editor-theme="light"] .tiptap.ProseMirror h2,
          [data-editor-theme="light"] .tiptap.ProseMirror h3 { color: var(--paper-ink-strong); }
          [data-editor-theme="light"] .tiptap.ProseMirror strong { color: var(--paper-ink-strong); }
          [data-editor-theme="light"] .tiptap.ProseMirror blockquote { color: var(--paper-ink-muted); }
          [data-editor-theme="light"] .tiptap.ProseMirror hr::before { color: var(--paper-ink-muted); }
          [data-editor-theme="light"] .tiptap.ProseMirror p.is-editor-empty:first-child::before { color: var(--paper-ink-muted); }

          /* Version history drawer */
          [data-editor-theme="light"] [data-slot="version-history-drawer"] {
            background-color: var(--paper-200);
            border-left-color: var(--paper-300);
            color: var(--paper-ink-strong);
          }
          [data-editor-theme="light"] [data-slot="version-history-drawer"] button {
            color: var(--paper-ink-muted);
          }
          [data-editor-theme="light"] [data-slot="version-history-drawer"] button:hover {
            color: var(--paper-ink-strong);
            background-color: var(--paper-200);
          }
          [data-editor-theme="light"] [data-slot="preview-banner"] {
            background-color: oklch(from var(--brand) l c h / 0.12);
            border-bottom-color: oklch(from var(--brand) l c h / 0.4);
            color: var(--paper-ink-strong);
          }
        `}</style>
      )}
      {corkboardMode ? <CorkboardView /> : <ChapterEditor />}
    </div>
  )
}
