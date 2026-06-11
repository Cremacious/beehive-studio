'use client'

import { useRef, useState } from 'react'
import { createId } from '@paralleldrive/cuid2'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove } from '@dnd-kit/sortable'
import { Pencil, Plus, Search, X } from 'lucide-react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { groupBeatsByAct, distinctActs } from '@/lib/outline/group-by-act'
import { canEditOutline, type HiveRole } from '@/lib/hive/permissions'
import { SaveStatusBadge, type FormSaveStatus } from '@/app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/save-status-badge'
import { OutlineBeatRow } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card'
import { readBeats, type Beat, type OutlineContent } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'
import { BeatDialog } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/beat-dialog'

type ChapterRef = { id: string; title: string; order: number }

type HiveOutlineData = {
  bookId: string
  entry: {
    outline: BinderItemRow
    lastEditedByUsername: string | null
    lastEditedAt: Date | null
  }
  chapters: ChapterRef[]
  viewerRole: HiveRole
}

export function HiveOutlineSurface({
  data,
  hiveId: _hiveId,
  locale,
}: {
  data: HiveOutlineData
  hiveId: string
  locale: string
}) {
  return (
    <HiveOutlineSurfaceInner
      outline={data.entry.outline}
      chapters={data.chapters}
      viewerRole={data.viewerRole}
      bookId={data.bookId}
      locale={locale}
      lastEditedByUsername={data.entry.lastEditedByUsername}
      lastEditedAt={data.entry.lastEditedAt}
    />
  )
}

function relTime(d: Date | null): string {
  if (!d) return ''
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function HiveOutlineSurfaceInner({
  outline,
  chapters,
  viewerRole,
  bookId: _bookId,
  locale: _locale,
  lastEditedByUsername,
  lastEditedAt,
}: {
  outline: BinderItemRow
  chapters: ChapterRef[]
  viewerRole: HiveRole
  bookId: string
  locale: string
  lastEditedByUsername: string | null
  lastEditedAt: Date | null
}) {
  const readOnly = !canEditOutline(viewerRole)
  const [title, setTitle] = useState<string>(outline.title || '')
  const [beats, setBeats] = useState<Beat[]>(() => readBeats(outline.content))
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')

  async function commitTitle(next: string) {
    const trimmed = next.trim()
    if (readOnly) return
    if (trimmed === (outline.title || '').trim()) return
    setTitle(trimmed)
    const r = await updateBinderItemAction(outline.id, { title: trimmed || 'Untitled outline' })
    if (!r.success) {
      // Roll back local state if the server rejected the rename.
      setTitle(outline.title || '')
    }
  }
  const [linkingBeatId, setLinkingBeatId] = useState<string | null>(null)
  const [pendingActs, setPendingActs] = useState<string[]>([])
  const [newActDraft, setNewActDraft] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Cross-act drop visual feedback. While the user drags a beat, track which
  // act key the pointer is currently hovering over (resolved by looking up
  // the act of the `over` beat). When the hover act differs from the source
  // act, that act's <article> card lights up with a brand ring + tinted bg
  // so the user knows "release here moves the beat into this act."
  const [draggingBeatId, setDraggingBeatId] = useState<string | null>(null)
  const [hoverActKey, setHoverActKey] = useState<string | null>(null)
  const sourceActKey = draggingBeatId
    ? (beats.find(b => b.id === draggingBeatId)?.act ?? null) ?? '__noact__'
    : null

  function handleDragStart(event: DragStartEvent) {
    if (readOnly) return
    setDraggingBeatId(String(event.active.id))
    const src = beats.find(b => b.id === event.active.id)
    setHoverActKey((src?.act ?? null) ?? '__noact__')
  }
  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) { setHoverActKey(null); return }
    const overBeat = beats.find(b => b.id === over.id)
    if (!overBeat) return
    setHoverActKey(overBeat.act ?? '__noact__')
  }
  function handleDragCancel() {
    setDraggingBeatId(null)
    setHoverActKey(null)
  }

  function commit(next: Beat[]) {
    setBeats(next)
    if (readOnly) return
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const content: OutlineContent = { beats: next }
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const result = await updateBinderItemAction(outline.id, { content: content as unknown as Record<string, unknown> })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  type DialogState =
    | { mode: 'closed' }
    | { mode: 'create'; defaultAct: string | null }
    | { mode: 'edit'; beatId: string }

  const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' })

  function openCreate(act: string | null = null) {
    if (readOnly) return
    setDialogState({ mode: 'create', defaultAct: act })
    if (act) setPendingActs(prev => prev.filter(a => a !== act))
  }

  function openEdit(beat: Beat) {
    setDialogState({ mode: 'edit', beatId: beat.id })
  }

  function closeDialog() {
    setDialogState({ mode: 'closed' })
  }

  const editingBeat: Beat | null =
    dialogState.mode === 'edit'
      ? beats.find(b => b.id === dialogState.beatId) ?? null
      : null

  function patchBeat(id: string, patch: Partial<Beat>) {
    if (readOnly) return
    commit(beats.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  function renameAct(oldName: string | null, raw: string) {
    if (readOnly || oldName === null) return
    const newName = raw.trim()
    if (!newName || newName === oldName) return
    commit(beats.map(b => b.act === oldName ? { ...b, act: newName } : b))
  }
  function handleDragEnd(event: DragEndEvent) {
    setDraggingBeatId(null)
    setHoverActKey(null)
    if (readOnly) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = beats.findIndex(b => b.id === active.id)
    const to = beats.findIndex(b => b.id === over.id)
    if (from < 0 || to < 0) return
    const targetAct = beats[to]!.act ?? null
    let next = arrayMove(beats, from, to)
    if ((next[to]!.act ?? null) !== targetAct) {
      next = next.map((b, i) => i === to ? { ...b, act: targetAct } : b)
    }
    commit(next)
  }
  function commitNewAct(raw: string) {
    const name = raw.trim()
    setNewActDraft(null)
    if (!name) return
    if (beats.some(b => b.act === name)) return
    setPendingActs(prev => prev.includes(name) ? prev : [...prev, name])
  }

  function isChapterAvailable(chapterId: string | null | undefined): boolean {
    if (!chapterId) return false
    return chapters.some(c => c.id === chapterId)
  }
  function chapterTitleFor(chapterId: string | null | undefined): string | null {
    if (!chapterId) return null
    return chapters.find(c => c.id === chapterId)?.title ?? null
  }

  return (
    <div data-slot="outline-pane" className="px-6 pb-6">
      <style>{`
        [data-slot="outline-pane"] {
          --sheet-canvas:     transparent;
          --sheet-bg:         var(--canvas-dark-100);
          --sheet-bg-hover:   var(--canvas-dark-200);
          --sheet-ink:        var(--canvas-dark-ink);
          --sheet-ink-strong: var(--canvas-dark-ink-strong);
          --sheet-ink-muted:  var(--canvas-dark-ink-muted);
          --sheet-rule:       var(--canvas-dark-300);
          --sheet-rule-soft:  oklch(from var(--canvas-dark-300) l c h / 0.55);
        }
        [data-slot="outline-pane"] [contenteditable]:focus {
          outline: 2px solid oklch(from var(--color-brand) l c h / 0.45);
          outline-offset: 2px;
          border-radius: 4px;
        }
        [data-slot="outline-pane"] [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--sheet-ink-muted);
          opacity: 0.55;
          font-style: italic;
          pointer-events: none;
        }
      `}</style>

      <header className="flex items-start justify-between gap-4 pt-6 pb-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 group">
            <h1
              role="textbox"
              aria-label="Outline title (click to rename)"
              contentEditable={!readOnly}
              suppressContentEditableWarning
              data-placeholder="Untitled outline"
              className="font-comfortaa font-bold leading-tight outline-none"
              style={{
                color: 'var(--brand)',
                fontSize: 28,
                cursor: readOnly ? 'default' : 'text',
              }}
              onBlur={e => commitTitle(e.currentTarget.textContent ?? '')}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.currentTarget as HTMLElement).blur()
                }
              }}
            >
              {title || ''}
            </h1>
            {!readOnly && (
              <span
                aria-hidden
                title="Click the title to rename"
                className="opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                <Pencil size={14} />
              </span>
            )}
          </div>
          {!readOnly && (
            <p
              className="mt-1.5 text-[12px]"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Click the title above to rename this outline.
            </p>
          )}
          {(lastEditedByUsername || lastEditedAt) && (
            <p
              className="mt-1 text-[13px]"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              {lastEditedByUsername
                ? `Last edited by @${lastEditedByUsername}${lastEditedAt ? ` · ${relTime(lastEditedAt)}` : ''}`
                : `Last edited ${relTime(lastEditedAt)}`}
            </p>
          )}
        </div>
        <div className="shrink-0 pt-1">
          <SaveStatusBadge status={saveStatus} />
        </div>
      </header>

      {!readOnly && (
        <p
          className="mb-4 text-[12.5px] leading-relaxed"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <span style={{ color: 'var(--canvas-dark-ink-strong)', fontWeight: 600 }}>Outline basics:</span>{' '}
          Beats are scenes. Acts group beats. Drag the{' '}
          <span className="inline-flex align-middle mx-0.5" style={{ color: 'var(--canvas-dark-ink)' }} aria-hidden>⋮⋮</span>
          {' '}handle to reorder beats or move them between acts. Dropping onto another act&apos;s card will highlight it in yellow.
        </p>
      )}

      <div data-slot="outline-pane-body">
        <div className="mx-auto" style={{ maxWidth: '100%' }}>
          {beats.length === 0 && pendingActs.length === 0 && newActDraft === null ? (
            !readOnly ? (
              <button
                type="button"
                onClick={() => openCreate(null)}
                className="w-full mt-4 px-4 py-6 rounded-md text-sm font-semibold italic transition-colors"
                style={{
                  background: 'transparent',
                  border: '1.5px dashed var(--sheet-rule)',
                  color: 'var(--sheet-ink-muted)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                + Add your first beat
              </button>
            ) : (
              <p
                className="mt-4 text-center text-sm italic"
                style={{ color: 'var(--sheet-ink-muted)' }}
              >
                The outline is empty.
              </p>
            )
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="flex flex-col gap-3.5">
                {groupBeatsByAct(beats).map(group => {
                  let globalIdx = 0
                  for (const b of beats) {
                    if (b.id === group.beats[0]?.id) break
                    globalIdx++
                  }
                  const actKey = group.act ?? '__noact__'
                  const isCrossActTarget = !!draggingBeatId
                    && hoverActKey === actKey
                    && sourceActKey !== actKey
                  return (
                    <article
                      key={actKey}
                      style={{
                        background: isCrossActTarget
                          ? 'linear-gradient(180deg, oklch(from var(--brand) l c h / 0.18), oklch(from var(--brand) l c h / 0.10))'
                          : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                        borderRadius: 'var(--r-row)',
                        boxShadow: isCrossActTarget
                          ? '0 0 0 2px var(--brand), 0 0 0 6px oklch(from var(--brand) l c h / 0.22), var(--sh-tile)'
                          : 'var(--sh-tile)',
                        overflow: 'hidden',
                        transition: 'background 120ms ease, box-shadow 120ms ease',
                      }}
                    >
                      <header
                        className="flex items-center justify-between gap-3 px-4 py-[11px]"
                        style={{
                          borderBottom: '1px solid oklch(from var(--canvas-dark-200) l c h / 0.6)',
                        }}
                      >
                        {group.act === null ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              color: 'var(--canvas-dark-ink-muted)',
                            }}
                          >
                            No Act
                          </span>
                        ) : readOnly ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              color: 'var(--canvas-dark-ink-strong)',
                            }}
                          >
                            {group.act}
                          </span>
                        ) : (
                          <input
                            defaultValue={group.act}
                            placeholder="Act name"
                            list="hive-outline-act-suggestions"
                            onBlur={e => renameAct(group.act, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') {
                                ;(e.target as HTMLInputElement).value = group.act ?? ''
                                ;(e.target as HTMLInputElement).blur()
                              }
                            }}
                            style={{
                              background: 'transparent',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              color: 'var(--canvas-dark-ink-strong)',
                            }}
                            className="focus:outline-none flex-1 min-w-0"
                          />
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => openCreate(group.act)}
                            className="inline-flex items-center gap-1.5 font-semibold transition-[background,transform] duration-150"
                            style={{
                              background: 'var(--brand)',
                              color: 'var(--brand-ink)',
                              borderRadius: 'var(--r-pill)',
                              boxShadow: 'var(--sh-tile)',
                              padding: '8px 18px',
                              fontSize: 13,
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => {
                              const el = e.currentTarget
                              el.style.background = 'var(--brand-hover)'
                              el.style.transform = 'translateY(-1px)'
                            }}
                            onMouseLeave={e => {
                              const el = e.currentTarget
                              el.style.background = 'var(--brand)'
                              el.style.transform = 'translateY(0)'
                            }}
                            onMouseDown={e => {
                              const el = e.currentTarget
                              el.style.background = 'var(--brand-active)'
                              el.style.transform = 'translateY(0)'
                            }}
                            onMouseUp={e => {
                              const el = e.currentTarget
                              el.style.background = 'var(--brand-hover)'
                              el.style.transform = 'translateY(-1px)'
                            }}
                          >
                            <Plus className="w-[15px] h-[15px]" strokeWidth={2.4} />
                            Add a beat
                          </button>
                        )}
                      </header>
                      <SortableContext items={group.beats.map(b => b.id)}>
                        <div>
                          {group.beats.map((beat, i) => {
                            const idx = globalIdx + i
                            return (
                              <OutlineBeatRow
                                key={beat.id}
                                beat={beat}
                                index={idx + 1}
                                isLast={i === group.beats.length - 1}
                                chapterAvailable={isChapterAvailable(beat.linkedChapterId)}
                                chapterTitle={chapterTitleFor(beat.linkedChapterId)}
                                onOpenLinkPopover={() => { if (!readOnly) setLinkingBeatId(beat.id) }}
                                onUnlink={() => patchBeat(beat.id, { linkedChapterId: null })}
                                onJumpToChapter={() => { /* no studio context in hive view */ }}
                                onEditClick={openEdit}
                              />
                            )
                          })}
                        </div>
                      </SortableContext>
                    </article>
                  )
                })}
                {!readOnly && pendingActs
                  .filter(name => !beats.some(b => b.act === name))
                  .map(name => (
                    <article
                      key={`pending:${name}`}
                      style={{
                        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                        borderRadius: 'var(--r-row)',
                        boxShadow: 'var(--sh-tile)',
                        overflow: 'hidden',
                      }}
                    >
                      <header
                        className="flex items-center justify-between gap-3 px-4 py-[11px]"
                        style={{
                          borderBottom: '1px solid oklch(from var(--canvas-dark-200) l c h / 0.6)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'var(--canvas-dark-ink-strong)',
                          }}
                        >
                          {name}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openCreate(name)}
                            className="inline-flex items-center gap-1.5 font-semibold transition-[background,transform] duration-150"
                            style={{
                              background: 'var(--brand)',
                              color: 'var(--brand-ink)',
                              borderRadius: 'var(--r-pill)',
                              boxShadow: 'var(--sh-tile)',
                              padding: '8px 18px',
                              fontSize: 13,
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => {
                              const el = e.currentTarget
                              el.style.background = 'var(--brand-hover)'
                              el.style.transform = 'translateY(-1px)'
                            }}
                            onMouseLeave={e => {
                              const el = e.currentTarget
                              el.style.background = 'var(--brand)'
                              el.style.transform = 'translateY(0)'
                            }}
                          >
                            <Plus className="w-[15px] h-[15px]" strokeWidth={2.4} />
                            Add a beat
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingActs(prev => prev.filter(a => a !== name))}
                            aria-label={`Discard empty act ${name}`}
                            className="inline-flex items-center px-2 py-1 rounded text-base"
                            style={{ color: 'var(--canvas-dark-ink-muted)' }}
                          >
                            ×
                          </button>
                        </div>
                      </header>
                    </article>
                  ))}
              </div>
            </DndContext>
          )}

          <datalist id="hive-outline-act-suggestions">
            {distinctActs(beats).map(a => <option key={a} value={a} />)}
          </datalist>

          {!readOnly && (newActDraft !== null ? (
            <div className="mt-3.5 flex items-stretch gap-2">
              <input
                autoFocus
                value={newActDraft}
                onChange={e => setNewActDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitNewAct(newActDraft)
                  }
                  if (e.key === 'Escape') { setNewActDraft(null) }
                }}
                placeholder="Act name"
                className="flex-1 px-4 py-[13px] rounded-[var(--r-row)] text-sm font-medium bg-transparent outline-none"
                style={{
                  border: '1px dashed var(--color-brand)',
                  color: 'var(--canvas-dark-ink)',
                  fontFamily: 'var(--font-ui)',
                }}
              />
              <button
                type="button"
                onClick={() => commitNewAct(newActDraft)}
                disabled={!newActDraft.trim()}
                className="px-4 rounded-[var(--r-row)] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setNewActDraft(null)}
                className="px-3 rounded-[var(--r-row)] text-sm font-medium transition-colors"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--canvas-dark-350)',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNewActDraft('')}
              className="w-full mt-3.5 py-[13px] flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-150"
              style={{
                background: 'transparent',
                border: '1px dashed var(--canvas-dark-350)',
                borderRadius: 'var(--r-row)',
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-ui)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.color = 'var(--canvas-dark-ink)'
                el.style.borderColor = 'var(--canvas-dark-400)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.color = 'var(--canvas-dark-ink-muted)'
                el.style.borderColor = 'var(--canvas-dark-350)'
              }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
              New Act
            </button>
          ))}

          {readOnly && (
            <p
              style={{
                background: 'var(--canvas-dark-100)',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink-muted)',
              }}
              className="mt-6 px-3 py-2 text-xs text-center"
            >
              Read-only. Your role is Beta Reader.
            </p>
          )}
        </div>
      </div>

      {linkingBeatId && (
        <HiveChapterLinkPopover
          chapters={chapters}
          onPick={chapterId => patchBeat(linkingBeatId, { linkedChapterId: chapterId })}
          onClose={() => setLinkingBeatId(null)}
        />
      )}

      <BeatDialog
        open={dialogState.mode !== 'closed'}
        mode={dialogState.mode === 'edit' ? 'edit' : 'create'}
        initial={editingBeat ?? {}}
        defaultAct={dialogState.mode === 'create' ? dialogState.defaultAct : null}
        chapters={chapters}
        readOnly={readOnly}
        onOpenChange={open => { if (!open) closeDialog() }}
        onSave={patch => {
          if (readOnly) return
          if (dialogState.mode === 'create') {
            const id = createId()
            const newBeat: Beat = {
              id,
              title: patch.title ?? '',
              description: patch.description,
              color: patch.color,
              label: patch.label,
              act: dialogState.defaultAct,
              linkedChapterId: patch.linkedChapterId ?? null,
            }
            commit([...beats, newBeat])
          } else if (dialogState.mode === 'edit' && editingBeat) {
            commit(beats.map(b => b.id === editingBeat.id ? { ...b, ...patch } : b))
          }
        }}
        onDelete={
          dialogState.mode === 'edit' && editingBeat && !readOnly
            ? () => commit(beats.filter(b => b.id !== editingBeat.id))
            : undefined
        }
      />
    </div>
  )
}

function HiveChapterLinkPopover({
  chapters,
  onPick,
  onClose,
}: {
  chapters: ChapterRef[]
  onPick: (chapterId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const sorted = [...chapters].sort((a, b) => a.order - b.order)
  const filtered = query.trim()
    ? sorted.filter(c => (c.title ?? '').toLowerCase().includes(query.trim().toLowerCase()))
    : sorted

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="min-w-[280px] w-[360px] max-h-[60vh] flex flex-col p-2"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span
            className="text-[10px] font-mono uppercase tracking-[0.10em]"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Link to chapter
          </span>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded p-1"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-1 pb-2">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5"
            style={{
              background: 'var(--canvas-dark-100)',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-inset)',
            }}
          >
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--canvas-dark-ink-muted)' }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search chapters…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--canvas-dark-ink)' }}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          sorted.length === 0 ? (
            <p
              style={{
                background: 'var(--canvas-dark-100)',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink-muted)',
              }}
              className="mx-1 mb-1 px-3 py-2 text-xs"
            >
              Standalone hive. No chapters available to link.
            </p>
          ) : (
            <p
              className="px-3 pb-3 text-xs italic"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              No chapters match that search.
            </p>
          )
        ) : (
          <div className="overflow-y-auto flex flex-col gap-0.5 px-1 pb-1">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => { onPick(c.id); onClose() }}
                className="text-left text-sm px-2.5 py-2 transition-colors"
                style={{ color: 'var(--canvas-dark-ink)', borderRadius: 'var(--r-row)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--canvas-dark-300)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {c.title || 'Untitled chapter'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
