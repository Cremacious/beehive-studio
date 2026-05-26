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
      style={isLight ? { backgroundColor: '#fcfcfa', color: '#1a1a1a' } : undefined}
    >
      {isLight && (
        <style>{`
          /* Toolbar */
          [data-editor-theme="light"] [data-slot="editor-toolbar"] {
            background-color: #f4f4ee;
            border-bottom-color: #e0e0d8;
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] button {
            color: rgba(26, 26, 26, 0.7);
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] button:hover {
            color: #1a1a1a;
            background-color: #e8e8e0;
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] button:disabled {
            color: rgba(26, 26, 26, 0.3);
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] .bg-border {
            background-color: #d0d0c8;
          }
          [data-editor-theme="light"] [data-slot="editor-toolbar"] select {
            background-color: #fcfcfa;
            border-color: #d0d0c8;
            color: #1a1a1a;
          }
          [data-editor-theme="light"] [data-slot="editor-status"],
          [data-editor-theme="light"] [data-slot="editor-status"] span {
            color: rgba(26, 26, 26, 0.7);
          }

          /* ProseMirror prose body */
          [data-editor-theme="light"] .tiptap.ProseMirror { color: #1a1a1a; caret-color: var(--color-brand); }
          [data-editor-theme="light"] .tiptap.ProseMirror h1,
          [data-editor-theme="light"] .tiptap.ProseMirror h2,
          [data-editor-theme="light"] .tiptap.ProseMirror h3 { color: #0a0a0a; }
          [data-editor-theme="light"] .tiptap.ProseMirror strong { color: #0a0a0a; }
          [data-editor-theme="light"] .tiptap.ProseMirror blockquote { color: #333; }
        `}</style>
      )}
      {corkboardMode ? <CorkboardView /> : <ChapterEditor />}
    </div>
  )
}
