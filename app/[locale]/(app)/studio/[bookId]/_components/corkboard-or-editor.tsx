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
  return (
    <div data-editor-theme={editorTheme} className="flex-1 flex flex-col overflow-hidden">
      {corkboardMode ? <CorkboardView /> : <ChapterEditor />}
    </div>
  )
}
