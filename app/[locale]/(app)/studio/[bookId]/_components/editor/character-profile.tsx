'use client'

import { useEffect, useRef, useState } from 'react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { TagChipStrip } from './tag-chip-strip'
import { normalizeTags } from '@/lib/wiki/tags'

// DP3 Task 2 — Character profile sheet-style rewrite.
//
// Mockup target: .char-sheet (cream-paper sheet on the chrome-walnut editor
// pane). Header card (avatar + name + meta) + 6 section cards (Appearance /
// Personality / Backstory / Arc / Relationships / Notes). Everything sits on
// cream paper, so all text uses paper-ink tokens — NOT text-foreground (which
// resolves to chrome-200 and would be invisible on cream). Lesson from Task 1.

// Per spec §4.3. Old shape (age / physicalDescription / personality /
// backstory / motivation / role / voice / notes) is read at mount with a
// migration step so existing characters render correctly. New edits write
// the new shape — no DB migration.
type Relationship = { targetCharacterId: string; relation: string }

type CharacterContent = {
  avatar?: string | null
  role?: string | null
  age?: string | null
  pronouns?: string | null
  appearance?: string | null
  personality?: string | null
  backstory?: string | null
  arc?: string | null
  relationships?: Relationship[] | null
  notes?: string | null
  tags?: string[] | null
}

// Legacy shape — anything not in the new shape gets folded in.
type LegacyCharacterContent = {
  age?: string
  physicalDescription?: string
  personality?: string
  backstory?: string
  motivation?: string
  role?: string
  voice?: string
  notes?: string
}

function readContent(raw: unknown): CharacterContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const c = raw as CharacterContent & LegacyCharacterContent
  // New-shape fields take precedence. Old physicalDescription folds into
  // appearance. Old motivation has no exact home; surface it in arc (closest
  // semantic match — character's drive shapes their arc) only if arc is empty.
  const arc = c.arc ?? (c.motivation ?? null)
  return {
    avatar: c.avatar ?? null,
    role: c.role ?? null,
    age: c.age ?? null,
    pronouns: c.pronouns ?? null,
    appearance: c.appearance ?? c.physicalDescription ?? null,
    personality: c.personality ?? null,
    backstory: c.backstory ?? null,
    arc,
    relationships: Array.isArray(c.relationships) ? c.relationships : null,
    notes: c.notes ?? null,
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

type Props = { item: BinderItemRow }

export function CharacterProfile({ item }: Props) {
  const { updateBinderItem } = useBookEditor()

  const initial = readContent(item.content)
  const contentRef = useRef<CharacterContent>(initial)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')

  // Title (character name) — inline contenteditable; commit on blur.
  const [localTitle, setLocalTitle] = useState(item.title)
  useEffect(() => setLocalTitle(item.title), [item.id, item.title])

  function scheduleSave(next: CharacterContent) {
    contentRef.current = next
    updateBinderItem(item.id, { content: next })
    setSaveStatus('unsaved')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      const result = await updateBinderItemAction(item.id, { content: next })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 1500)
  }

  function setField<K extends keyof CharacterContent>(key: K, value: CharacterContent[K]) {
    scheduleSave({ ...contentRef.current, [key]: value })
  }

  async function commitTitle(next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed === item.title) {
      setLocalTitle(item.title)
      return
    }
    setLocalTitle(trimmed)
    updateBinderItem(item.id, { title: trimmed })
    const result = await updateBinderItemAction(item.id, { title: trimmed })
    if (!result.success) setLocalTitle(item.title)
  }

  function removeRelationship(idx: number) {
    const current = contentRef.current.relationships ?? []
    const next = current.filter((_, i) => i !== idx)
    setField('relationships', next.length === 0 ? null : next)
  }

  const c = contentRef.current

  return (
    <main
      data-slot="character-sheet-pane"
      key={item.id}
      className="flex-1 flex flex-col overflow-hidden"
    >
      {/* Theme-aware surface vars. Dark editor mode: warm-coffee canvas-dark
          chrome with high-contrast ink. Light editor mode: cream paper with
          paper-ink-strong (one step darker than the default paper-ink) for
          better long-prose readability — Chris's preference. */}
      <style>{`
        [data-slot="character-sheet-pane"] {
          --sheet-bg:         var(--canvas-dark-100);
          --sheet-bg-inset:   var(--canvas-dark-200);
          --sheet-canvas:     var(--background);
          --sheet-ink:        var(--canvas-dark-ink);
          --sheet-ink-strong: var(--canvas-dark-ink-strong);
          --sheet-ink-muted:  var(--canvas-dark-ink-muted);
          --sheet-rule:       var(--canvas-dark-300);
        }
        [data-editor-theme="light"] [data-slot="character-sheet-pane"] {
          --sheet-bg:         var(--paper-100);
          --sheet-bg-inset:   var(--paper-50);
          --sheet-canvas:     var(--paper-200);
          --sheet-ink:        var(--paper-ink-strong);
          --sheet-ink-strong: var(--paper-ink-strong);
          --sheet-ink-muted:  var(--paper-ink);
          --sheet-rule:       var(--paper-300);
        }
        [data-slot="character-sheet-pane"] [contenteditable]:focus {
          outline: 2px solid oklch(from var(--color-brand) l c h / 0.45);
          outline-offset: 2px;
          border-radius: 4px;
        }
        [data-slot="character-sheet-pane"] [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--sheet-ink-muted);
          opacity: 0.55;
          font-style: italic;
          pointer-events: none;
        }
      `}</style>

      {/* Surface head — breadcrumb + save badge. Mirrors note-editor pattern. */}
      <header
        data-slot="character-surface-head"
        className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-surface"
      >
        <span
          className="inline-block w-2 h-2 rounded-sm"
          style={{ backgroundColor: 'var(--type-character, oklch(0.62 0.10 30))' }}
          aria-hidden
        />
        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
          Character
        </span>
        <span className="text-sm font-medium text-foreground/90 truncate">{localTitle}</span>
        <div className="flex-1" />
        <SaveStatusBadge status={saveStatus} />
      </header>

      {/* Character pane — chrome-walnut backing (per mockup .char-pane). */}
      <div
        data-slot="character-pane"
        className="flex-1 overflow-y-auto"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, oklch(0.85 0.18 90 / 0.04), transparent 40%), var(--sheet-canvas)',
        }}
      >
        <div className="mx-auto max-w-[720px] px-8 pt-7 pb-14">
          {/* Header card — avatar + name + meta */}
          <div
            data-slot="character-header"
            className="grid items-center gap-[22px] px-8 pt-7 pb-6"
            style={{
              gridTemplateColumns: '96px 1fr',
              background: 'var(--sheet-bg)',
              color: 'var(--sheet-ink)',
              borderRadius: '10px 10px 4px 4px',
              boxShadow:
                '0 1px 0 var(--paper-50) inset, 0 2px 6px rgba(0,0,0,0.3), 0 12px 32px -10px rgba(0,0,0,0.4)',
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(95,60,20,0.04) 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          >
            {/* Avatar — initials placeholder only.
                TODO(avatar-upload): wire to useCloudinaryUpload('character-avatars')
                — same hook used by about-author-form. Save URL to content.avatar
                and render as <img> when present. Deferred to keep DP3 Task 2
                scoped to visual port; per plan §Step 3 "ship placeholder initials". */}
            <div
              data-slot="character-avatar"
              className="flex items-center justify-center"
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background:
                  'linear-gradient(135deg, var(--type-character, oklch(0.62 0.10 30)), oklch(0.5 0.1 35))',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 36,
                color: 'var(--paper-100)',
                letterSpacing: '-0.02em',
                boxShadow:
                  '0 1px 0 rgba(255,255,255,0.4) inset, 0 2px 6px rgba(60,40,20,0.25)',
                flexShrink: 0,
              }}
              aria-label="Character avatar (placeholder initials)"
            >
              {getInitials(localTitle)}
            </div>

            <div className="min-w-0">
              <h2
                data-slot="character-name"
                contentEditable
                suppressContentEditableWarning
                onBlur={e => commitTitle(e.currentTarget.textContent ?? '')}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.currentTarget as HTMLElement).blur()
                  }
                }}
                className="m-0 mb-1.5 outline-none"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  color: 'var(--sheet-ink-strong)',
                }}
                data-placeholder="Character name"
              >
                {localTitle}
              </h2>
              <div
                className="flex items-center gap-3 flex-wrap"
                style={{
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  fontSize: 11.5,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--sheet-ink-muted)',
                }}
              >
                <MetaPill
                  label="role"
                  value={c.role ?? ''}
                  placeholder="Role"
                  onCommit={v => setField('role', v || null)}
                />
                <MetaText
                  value={c.age ?? ''}
                  placeholder="Age"
                  onCommit={v => setField('age', v || null)}
                />
                <span style={{ color: 'var(--sheet-ink-muted)' }}>·</span>
                <MetaText
                  value={c.pronouns ?? ''}
                  placeholder="Pronouns"
                  onCommit={v => setField('pronouns', v || null)}
                />
              </div>
              <div className="mt-3">
                <TagChipStrip
                  tags={c.tags ?? []}
                  onChange={next => setField('tags', normalizeTags(next))}
                  accentColor="--wiki-character"
                />
              </div>
            </div>
          </div>

          {/* Section cards grid */}
          <div
            data-slot="character-sections"
            className="mt-[22px] flex flex-col"
          >
            <SectionCard
              indexLabel="01 · Description"
              title="Appearance"
              value={c.appearance ?? ''}
              placeholder="What do they look like?"
              onCommit={v => setField('appearance', v || null)}
            />
            <SectionCard
              indexLabel="02 · Inner"
              title="Personality"
              value={c.personality ?? ''}
              placeholder="How do they act, think, feel?"
              onCommit={v => setField('personality', v || null)}
            />
            <SectionCard
              indexLabel="03 · Before"
              title="Backstory"
              value={c.backstory ?? ''}
              placeholder="What shaped them before the story began?"
              onCommit={v => setField('backstory', v || null)}
            />
            <SectionCard
              indexLabel="04 · Change"
              title="Character arc"
              value={c.arc ?? ''}
              placeholder="How do they change across the story?"
              onCommit={v => setField('arc', v || null)}
            />

            {/* Relationships — list + placeholder add button */}
            <section
              data-slot="character-section"
              className="pt-8 border-t border-[var(--sheet-rule)]"
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  fontSize: 10.5,
                  letterSpacing: '0.20em',
                  textTransform: 'uppercase',
                  color: 'var(--sheet-ink-muted)',
                  marginBottom: 4,
                }}
              >
                05 · People
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--sheet-ink-strong)',
                  margin: '0 0 12px',
                }}
              >
                Relationships
              </h3>
              {(c.relationships?.length ?? 0) === 0 ? (
                <p
                  style={{
                    fontFamily: 'var(--font-prose)',
                    fontSize: 14,
                    color: 'var(--sheet-ink-muted)',
                    fontStyle: 'italic',
                    margin: 0,
                  }}
                >
                  No linked characters yet.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {(c.relationships ?? []).map((rel, idx) => (
                    <div
                      key={`${rel.targetCharacterId}-${idx}`}
                      className="grid items-center gap-2.5 px-2.5 py-2"
                      style={{
                        gridTemplateColumns: '28px 1fr auto auto 20px',
                        borderRadius: 6,
                        background: 'oklch(0.78 0.04 60 / 0.10)',
                        border: '1px solid oklch(0.78 0.04 60 / 0.20)',
                      }}
                    >
                      <div
                        className="inline-flex items-center justify-center"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background:
                            'linear-gradient(135deg, var(--color-brand), oklch(0.5 0.1 60))',
                          color: 'var(--paper-100)',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                        aria-hidden
                      >
                        {getInitials(rel.targetCharacterId)}
                      </div>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--sheet-ink-strong)',
                        }}
                      >
                        {rel.targetCharacterId}
                      </span>
                      <span
                        style={{
                          color: 'var(--sheet-ink-muted)',
                          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                        }}
                      >
                        →
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                          fontSize: 11,
                          letterSpacing: '0.04em',
                          color: 'var(--sheet-ink-muted)',
                          padding: '2px 9px',
                          borderRadius: 999,
                          background: 'var(--sheet-bg)',
                          border: '1px solid oklch(0.78 0.04 60 / 0.25)',
                          textTransform: 'lowercase',
                        }}
                      >
                        {rel.relation}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRelationship(idx)}
                        className="inline-flex items-center justify-center"
                        aria-label={`Remove relationship with ${rel.targetCharacterId}`}
                        style={{
                          width: 20,
                          height: 20,
                          color: 'var(--sheet-ink-muted)',
                          borderRadius: 4,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* TODO(character-picker): add a character-picker popover that
                  lists other character binder items in this book, lets the user
                  pick a target + type a relation label, and appends to
                  content.relationships. Deferred per plan §Step 2 — the picker
                  would need a roster query + popover UX outside the scope of
                  this visual port. Shipping placeholder button only. */}
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 mt-2 px-3 py-2 cursor-not-allowed"
                style={{
                  borderRadius: 6,
                  background: 'transparent',
                  border: '1.5px dashed oklch(0.78 0.04 60 / 0.40)',
                  color: 'var(--sheet-ink-muted)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 13,
                  opacity: 0.6,
                }}
                title="Character picker coming soon"
              >
                + Link a character (coming soon)
              </button>
            </section>

            <SectionCard
              indexLabel="06 · Loose"
              title="Notes"
              value={c.notes ?? ''}
              placeholder="Anything else worth remembering…"
              onCommit={v => setField('notes', v || null)}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

// Single-paragraph contenteditable card. Saves on blur to keep behavior
// predictable (typing inside a contenteditable + debounce-per-keystroke gets
// fiddly with React + caret position). Same pattern as note-title.
function SectionCard({ indexLabel, title, value, placeholder, onCommit }: {
  indexLabel: string
  title: string
  value: string
  placeholder: string
  onCommit: (next: string) => void
}) {
  return (
    <section
      data-slot="character-section"
      className="pt-8 first:pt-2 border-t border-[var(--sheet-rule)] first:border-t-0"
    >
      <div
        style={{
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 10.5,
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color: 'var(--sheet-ink-muted)',
          marginBottom: 4,
        }}
      >
        {indexLabel}
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--sheet-ink-strong)',
          margin: '0 0 12px',
        }}
      >
        {title}
      </h3>
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={e => {
          const next = (e.currentTarget.textContent ?? '').trim()
          if (next !== value.trim()) onCommit(next)
        }}
        className="outline-none"
        style={{
          fontFamily: 'var(--font-prose)',
          fontSize: 15,
          lineHeight: 1.7,
          color: 'var(--sheet-ink)',
          minHeight: '2.4em',
        }}
        data-placeholder={placeholder}
      >
        {value}
      </div>
    </section>
  )
}

// Meta line — inline contenteditable span; styled like a pill when role is set.
function MetaPill({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string
  value: string
  placeholder: string
  onCommit: (next: string) => void
}) {
  const hasValue = value.trim().length > 0
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={e => {
        const next = (e.currentTarget.textContent ?? '').trim()
        if (next !== value.trim()) onCommit(next)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).blur()
        }
      }}
      className="inline-flex items-center outline-none"
      style={{
        padding: '3px 9px',
        background: hasValue ? 'oklch(0.72 0.110 35 / 0.18)' : 'transparent',
        color: hasValue ? 'oklch(0.42 0.110 35)' : 'var(--sheet-ink-muted)',
        borderRadius: 999,
        fontWeight: 600,
        border: hasValue ? 'none' : '1px dashed oklch(0.78 0.04 60 / 0.40)',
        minWidth: hasValue ? undefined : 60,
      }}
      data-placeholder={placeholder}
      aria-label={label}
    >
      {value}
    </span>
  )
}

function MetaText({
  value,
  placeholder,
  onCommit,
}: {
  value: string
  placeholder: string
  onCommit: (next: string) => void
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={e => {
        const next = (e.currentTarget.textContent ?? '').trim()
        if (next !== value.trim()) onCommit(next)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).blur()
        }
      }}
      className="outline-none"
      style={{
        color: 'var(--sheet-ink)',
        fontWeight: 500,
        minWidth: 40,
      }}
      data-placeholder={placeholder}
    >
      {value}
    </span>
  )
}
