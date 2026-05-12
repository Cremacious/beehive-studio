'use client'

import { useBookEditor } from './book-editor-provider'
import { ChapterEditor } from './editor/chapter-editor'
import { CorkboardView } from './corkboard-view'

export function CorkboardOrEditor() {
  const { corkboardMode } = useBookEditor()
  return corkboardMode ? <CorkboardView /> : <ChapterEditor />
}
