'use client'

import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { X } from 'lucide-react'
import type { WikiSection as Section } from '@/lib/wiki/sections'

type Props = {
  section: Section
  placeholder?: string
  readOnly?: boolean
  /** Hide the remove button (entries must have at least 1 section). */
  hideRemove?: boolean
  onChange: (next: Section) => void
  onRemove: () => void
}

export function WikiSection({
  section,
  placeholder = 'Add some notes…',
  readOnly = false,
  hideRemove = false,
  onChange,
  onRemove,
}: Props) {
  const [bodyFocused, setBodyFocused] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Headings disabled inside a section — the section's label IS the H2 now.
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: section.body as Parameters<typeof useEditor>[0]['content'],
    editable: !readOnly,
    onUpdate({ editor: e }) {
      if (e.isDestroyed) return
      onChange({ ...section, body: e.getJSON() })
    },
    onFocus() { setBodyFocused(true) },
    onBlur() { setBodyFocused(false) },
  }, [section.id])

  function commitLabel(text: string) {
    const trimmed = text.trim() || 'Untitled section'
    if (trimmed === section.label) return
    onChange({ ...section, label: trimmed })
  }

  const isDefaultLabel = section.label === 'New section'

  return (
    <div className="wiki-section group" data-focused={bodyFocused ? 'true' : 'false'}>
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="inline-flex items-baseline gap-2 min-w-0">
          <span
            className="wiki-section-label"
            role="textbox"
            aria-label="Section label"
            contentEditable={!readOnly}
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={e => commitLabel(e.currentTarget.textContent ?? '')}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.currentTarget as HTMLElement).blur()
              }
            }}
          >
            {section.label}
          </span>
          {!readOnly && isDefaultLabel && (
            <span
              aria-hidden
              className="wiki-section-hint text-[10px] italic"
            >
              (click section title to edit)
            </span>
          )}
        </span>
        {!readOnly && !hideRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${section.label}`}
            className="wiki-section-remove opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.10em] transition-opacity"
          >
            <X size={11} /> Remove
          </button>
        )}
      </div>
      <div
        className="wiki-section-body px-5 py-4 cursor-text"
        style={{
          background: 'var(--wiki-body-bg)',
          boxShadow: bodyFocused
            ? 'var(--wiki-body-shadow), 0 0 0 2px var(--wiki-ring)'
            : 'var(--wiki-body-shadow)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--wiki-body-border-color)',
          borderRadius: 14,
          transition: 'box-shadow 0.15s ease',
        }}
        onClick={() => {
          if (editor && !editor.isDestroyed) editor.commands.focus()
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
