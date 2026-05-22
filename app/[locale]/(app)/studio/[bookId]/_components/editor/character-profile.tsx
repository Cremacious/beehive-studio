'use client'

import { useEffect, useRef, useState } from 'react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'

type CharacterProfile = {
  age?: string
  physicalDescription?: string
  personality?: string
  backstory?: string
  motivation?: string
  role?: string
  voice?: string
  notes?: string
}

type Props = {
  item: BinderItemRow
}

function ProfileField({
  label,
  placeholder,
  fieldKey,
  value,
  onChange,
  multiline,
}: {
  label: string
  placeholder: string
  fieldKey: keyof CharacterProfile
  value: string
  onChange: (key: keyof CharacterProfile, value: string) => void
  multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {multiline ? (
        <textarea
          className="resize-none bg-surface-inset border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 outline-none focus:border-brand/40 transition-colors leading-relaxed min-h-20"
          placeholder={placeholder}
          defaultValue={value}
          onChange={e => onChange(fieldKey, e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="bg-surface-inset border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 outline-none focus:border-brand/40 transition-colors"
          placeholder={placeholder}
          defaultValue={value}
          onChange={e => onChange(fieldKey, e.target.value)}
        />
      )}
    </div>
  )
}

export function CharacterProfile({ item }: Props) {
  const { updateBinderItem } = useBookEditor()

  const profile: CharacterProfile =
    item.content && typeof item.content === 'object' && !Array.isArray(item.content)
      ? (item.content as CharacterProfile)
      : {}

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileRef = useRef<CharacterProfile>(profile)

  const [isRenaming, setIsRenaming] = useState(false)
  const [localTitle, setLocalTitle] = useState(item.title)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
  }, [isRenaming])

  async function commitRename() {
    const next = titleInputRef.current?.value.trim() || localTitle
    setIsRenaming(false)
    if (next === localTitle) return
    const prev = localTitle
    setLocalTitle(next)
    updateBinderItem(item.id, { title: next })
    const result = await updateBinderItemAction(item.id, { title: next })
    if (!result.success) setLocalTitle(prev)
  }

  function handleFieldChange(key: keyof CharacterProfile, val: string) {
    const newProfile = { ...profileRef.current, [key]: val }
    profileRef.current = newProfile
    updateBinderItem(item.id, { content: newProfile })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updateBinderItemAction(item.id, { content: newProfile })
    }, 1500)
  }

  return (
    <main key={item.id} className="flex-1 flex flex-col overflow-hidden">
      <div className="px-8 py-6 border-b border-border">
        {isRenaming ? (
          <input
            ref={titleInputRef}
            defaultValue={localTitle}
            className="text-lg font-semibold text-foreground bg-transparent border-b border-brand outline-none w-full max-w-md"
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            onBlur={commitRename}
          />
        ) : (
          <div className="flex items-center gap-3">
            <h2
              className="text-lg font-semibold text-foreground cursor-pointer hover:text-brand transition-colors"
              onDoubleClick={() => setIsRenaming(true)}
              title="Double-click to rename"
            >
              {localTitle}
            </h2>
            <button
              onClick={() => setIsRenaming(true)}
              className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-brand/40 transition-colors"
            >
              ✎ Edit character name
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">Character Profile</p>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-2xl space-y-5">
          <ProfileField
            label="Age"
            placeholder="How old are they?"
            fieldKey="age"
            value={profile.age ?? ''}
            onChange={handleFieldChange}
          />
          <ProfileField
            label="Physical Description"
            placeholder="What do they look like?"
            fieldKey="physicalDescription"
            value={profile.physicalDescription ?? ''}
            onChange={handleFieldChange}
            multiline
          />
          <ProfileField
            label="Personality"
            placeholder="How do they act, think, feel?"
            fieldKey="personality"
            value={profile.personality ?? ''}
            onChange={handleFieldChange}
            multiline
          />
          <ProfileField
            label="Backstory"
            placeholder="What shaped them before the story began?"
            fieldKey="backstory"
            value={profile.backstory ?? ''}
            onChange={handleFieldChange}
            multiline
          />
          <ProfileField
            label="Motivation"
            placeholder="What do they want most?"
            fieldKey="motivation"
            value={profile.motivation ?? ''}
            onChange={handleFieldChange}
            multiline
          />
          <ProfileField
            label="Role in Story"
            placeholder="Protagonist, antagonist, mentor…?"
            fieldKey="role"
            value={profile.role ?? ''}
            onChange={handleFieldChange}
          />
          <ProfileField
            label="Voice & Speech"
            placeholder="How do they talk? Accent, vocabulary, quirks?"
            fieldKey="voice"
            value={profile.voice ?? ''}
            onChange={handleFieldChange}
            multiline
          />
          <ProfileField
            label="Notes"
            placeholder="Anything else…"
            fieldKey="notes"
            value={profile.notes ?? ''}
            onChange={handleFieldChange}
            multiline
          />
        </div>
      </div>
    </main>
  )
}
