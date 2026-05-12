'use client'

import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { saveHiveOutlineAction } from '@/lib/actions/hive-content.actions'

type Props = { hiveId: string; initialContent: string | null }

export function HiveOutlineEditor({ hiveId, initialContent }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your story outline here — acts, beats, chapter summaries…' }),
    ],
    content: initialContent ? JSON.parse(initialContent) : null,
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        await saveHiveOutlineAction(hiveId, JSON.stringify(editor.getJSON()))
      }, 2000)
    },
    editorProps: { attributes: { class: 'outline-none min-h-full' } },
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border bg-surface text-xs text-muted-foreground flex items-center justify-between">
        <span className="font-medium">Story Outline</span>
        <span className="text-foreground/40">Shared — edits auto-save</span>
      </div>
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto prose prose-invert prose-sm w-full"
      />
    </div>
  )
}
