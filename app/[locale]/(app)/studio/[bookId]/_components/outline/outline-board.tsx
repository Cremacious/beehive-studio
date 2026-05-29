'use client'

import { useEffect, useRef, useState } from 'react'
import { createId } from '@paralleldrive/cuid2'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { OutlineBeatRow } from './outline-card'
import { ChapterLinkPopover } from './chapter-link-popover'
import { groupBeatsByAct, distinctActs } from '@/lib/outline/group-by-act'

// DP3 Task 4 — Outline Kanban → beat-sheet. Vertical sortable list of beats.
// Legacy {columns, cards} content is flattened at render time (column order
// preserved, column grouping discarded, status defaulted to 'idea'). The
// first save after a legacy item is opened writes the new flat {beats} shape.

// ── Types ────────────────────────────────────────────────────────────────────

export type BeatStatus = 'idea' | 'drafting' | 'done'

export type Beat = {
  id: string
  title: string
  description?: string
  status?: BeatStatus
  linkedChapterId?: string | null
  act?: string | null
}

export type OutlineContent = { beats: Beat[] }

type LegacyCard = {
  id: string
  columnId: string
  title: string
  description?: string
  synopsis?: string
  linkedChapterId?: string
}
type LegacyColumn = { id: string; title: string; cards?: LegacyCard[] }
type LegacyOutlineContent = {
  columns?: LegacyColumn[]
  // some legacy shapes had cards as a flat array with a columnId pointer.
  cards?: LegacyCard[]
}

export function readBeats(raw: unknown): Beat[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const c = raw as Partial<OutlineContent> & LegacyOutlineContent
  if (Array.isArray(c.beats)) return c.beats
  // Legacy migration: flatten cards in column order. Column grouping is
  // discarded (accepted per spec §4.5b). All migrated beats start at 'idea'.
  if (Array.isArray(c.columns)) {
    // Cards live either nested under columns[].cards (current shape) or as a
    // flat top-level cards array with columnId pointers (older shape).
    const nestedCards: LegacyCard[] = c.columns.flatMap(col => (col.cards ?? []).map(card => ({ ...card, columnId: card.columnId ?? col.id })))
    const flatCards = Array.isArray(c.cards) ? c.cards : []
    const allCards: LegacyCard[] = nestedCards.length > 0 ? nestedCards : flatCards
    const colOrder = c.columns.map(col => col.id)
    return [...allCards]
      .sort((a, b) => {
        const ai = colOrder.indexOf(a.columnId)
        const bi = colOrder.indexOf(b.columnId)
        return (ai < 0 ? colOrder.length : ai) - (bi < 0 ? colOrder.length : bi)
      })
      .map(card => ({
        id: card.id,
        title: card.title ?? '',
        description: card.description ?? card.synopsis,
        status: 'idea' as const,
        linkedChapterId: card.linkedChapterId ?? null,
      }))
  }
  return []
}

const STATUS_CYCLE: BeatStatus[] = ['idea', 'drafting', 'done']
function nextStatus(s: BeatStatus | undefined): BeatStatus {
  const i = STATUS_CYCLE.indexOf((s ?? 'idea') as BeatStatus)
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]!
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = { item: BinderItemRow }

export function OutlineBoard({ item }: Props) {
  const { binderItems, setActiveItemId, updateBinderItem } = useBookEditor()
  const [beats, setBeats] = useState<Beat[]>(() => readBeats(item.content))
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const [linkingBeatId, setLinkingBeatId] = useState<string | null>(null)
  const [pendingActs, setPendingActs] = useState<string[]>([])
  const [newActDraft, setNewActDraft] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // First-open migration: if content was legacy-shaped, persist the flat shape
  // immediately so subsequent reads are stable.
  useEffect(() => {
    const c = item.content as Partial<OutlineContent> | null
    if (!c || !Array.isArray((c as OutlineContent).beats)) {
      const next: OutlineContent = { beats }
      void updateBinderItemAction(item.id, { content: next })
      updateBinderItem(item.id, { content: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commit(next: Beat[]) {
    setBeats(next)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const content: OutlineContent = { beats: next }
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      updateBinderItem(item.id, { content })
      const result = await updateBinderItemAction(item.id, { content })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  function addBeat(act?: string | null) {
    const resolvedAct = act !== undefined ? act : null
    commit([...beats, { id: createId(), title: '', description: '', status: 'idea', linkedChapterId: null, act: resolvedAct }])
    if (resolvedAct) setPendingActs(prev => prev.filter(a => a !== resolvedAct))
  }
  function patchBeat(id: string, patch: Partial<Beat>) {
    commit(beats.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  function deleteBeat(id: string) {
    commit(beats.filter(b => b.id !== id))
  }
  function cycleStatus(id: string) {
    const b = beats.find(x => x.id === id)
    if (!b) return
    patchBeat(id, { status: nextStatus(b.status) })
  }

  function renameAct(oldName: string | null, raw: string) {
    if (oldName === null) return
    const newName = raw.trim()
    if (!newName || newName === oldName) return
    commit(beats.map(b => b.act === oldName ? { ...b, act: newName } : b))
  }

  function handleDragEnd(event: DragEndEvent) {
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
    return binderItems.some(b => b.type === 'chapter' && b.chapterId === chapterId)
  }
  function chapterTitleFor(chapterId: string | null | undefined): string | null {
    if (!chapterId) return null
    const bi = binderItems.find(b => b.type === 'chapter' && b.chapterId === chapterId)
    return bi?.title ?? null
  }
  function jumpToChapter(chapterId: string) {
    const binderItem = binderItems.find(b => b.type === 'chapter' && b.chapterId === chapterId)
    if (binderItem) setActiveItemId(binderItem.id)
  }

  return (
    <main
      data-slot="outline-pane"
      key={item.id}
      className="flex-1 flex flex-col overflow-hidden"
    >
      {/* Theme-aware surface vars — same bridge pattern as character-profile.
          Dark mode: warm walnut canvas + canvas-dark inks. Light mode: cream
          paper + paper-ink-strong for crispness. */}
      <style>{`
        [data-slot="outline-pane"] {
          --sheet-canvas:     var(--background);
          --sheet-bg:         var(--canvas-dark-100);
          --sheet-bg-hover:   var(--canvas-dark-200);
          --sheet-ink:        var(--canvas-dark-ink);
          --sheet-ink-strong: var(--canvas-dark-ink-strong);
          --sheet-ink-muted:  var(--canvas-dark-ink-muted);
          --sheet-rule:       var(--canvas-dark-300);
          --sheet-rule-soft:  oklch(from var(--canvas-dark-300) l c h / 0.55);
        }
        [data-editor-theme="light"] [data-slot="outline-pane"] {
          --sheet-canvas:     var(--paper-200);
          --sheet-bg:         var(--paper-100);
          --sheet-bg-hover:   var(--paper-50);
          --sheet-ink:        var(--paper-ink-strong);
          --sheet-ink-strong: var(--paper-ink-strong);
          --sheet-ink-muted:  var(--paper-ink);
          --sheet-rule:       var(--paper-300);
          --sheet-rule-soft:  oklch(from var(--paper-300) l c h / 0.7);
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

      <header
        data-slot="outline-surface-head"
        className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-surface"
      >
        <span
          className="inline-block w-2 h-2 rounded-sm"
          style={{ backgroundColor: 'var(--type-outline, oklch(0.68 0.10 200))' }}
          aria-hidden
        />
        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
          Outline
        </span>
        <span className="text-sm font-medium text-foreground/90 truncate">{item.title}</span>
        <span className="text-[11px] text-muted-foreground/70">
          · {beats.length} beat{beats.length === 1 ? '' : 's'}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => addBeat()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
          style={{
            background: 'var(--color-brand)',
            color: 'var(--brand-ink, oklch(0.18 0.02 60))',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add beat
        </button>
        <SaveStatusBadge status={saveStatus} />
      </header>

      <div
        data-slot="outline-pane-body"
        className="flex-1 overflow-y-auto"
        style={{ background: 'var(--sheet-canvas)' }}
      >
        <div
          className="mx-auto px-8 py-6"
          style={{ maxWidth: 760 }}
        >
          {beats.length === 0 && pendingActs.length === 0 && newActDraft === null ? (
            <button
              type="button"
              onClick={() => addBeat()}
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex flex-col gap-6">
                {groupBeatsByAct(beats).map(group => {
                  let globalIdx = 0
                  for (const b of beats) {
                    if (b.id === group.beats[0]?.id) break
                    globalIdx++
                  }
                  return (
                    <section key={group.act ?? '__noact__'} className="space-y-2">
                      <header className="flex items-center gap-2">
                        {group.act === null ? (
                          <span
                            className="font-comfortaa font-bold text-base"
                            style={{ color: 'var(--sheet-ink-muted)' }}
                          >
                            No Act
                          </span>
                        ) : (
                          <input
                            defaultValue={group.act}
                            placeholder="Act name"
                            list="outline-act-suggestions"
                            onBlur={e => renameAct(group.act, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') {
                                ;(e.target as HTMLInputElement).value = group.act ?? ''
                                ;(e.target as HTMLInputElement).blur()
                              }
                            }}
                            className="font-comfortaa font-bold text-base bg-transparent border-b border-transparent hover:border-border focus:border-brand outline-none"
                          />
                        )}
                        <span className="text-xs" style={{ color: 'var(--sheet-ink-muted)' }}>
                          {group.beats.length} beat{group.beats.length === 1 ? '' : 's'}
                        </span>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => addBeat(group.act)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold"
                          style={{ color: 'var(--sheet-ink-muted)' }}
                        >
                          <Plus className="w-3 h-3" />
                          Add beat
                        </button>
                      </header>
                      <SortableContext items={group.beats.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-1.5">
                          {group.beats.map((beat, i) => {
                            const idx = globalIdx + i
                            return (
                              <OutlineBeatRow
                                key={beat.id}
                                beat={beat}
                                index={idx + 1}
                                isLast={idx === beats.length - 1}
                                chapterAvailable={isChapterAvailable(beat.linkedChapterId)}
                                chapterTitle={chapterTitleFor(beat.linkedChapterId)}
                                onChange={patch => patchBeat(beat.id, patch)}
                                onDelete={() => deleteBeat(beat.id)}
                                onCycleStatus={() => cycleStatus(beat.id)}
                                onOpenLinkPopover={() => setLinkingBeatId(beat.id)}
                                onUnlink={() => patchBeat(beat.id, { linkedChapterId: null })}
                                onJumpToChapter={() => {
                                  if (beat.linkedChapterId) jumpToChapter(beat.linkedChapterId)
                                }}
                              />
                            )
                          })}
                        </div>
                      </SortableContext>
                    </section>
                  )
                })}
                {pendingActs
                  .filter(name => !beats.some(b => b.act === name))
                  .map(name => (
                    <section key={`pending:${name}`} className="space-y-2">
                      <header className="flex items-center gap-2">
                        <span className="font-comfortaa font-bold text-base" style={{ color: 'var(--sheet-ink-muted)' }}>
                          {name}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--sheet-ink-muted)' }}>
                          0 beats
                        </span>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => addBeat(name)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold"
                          style={{ color: 'var(--sheet-ink-muted)' }}
                        >
                          <Plus className="w-3 h-3" />
                          Add beat
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingActs(prev => prev.filter(a => a !== name))}
                          aria-label={`Discard empty act ${name}`}
                          className="inline-flex items-center px-1.5 py-1 rounded text-[11px]"
                          style={{ color: 'var(--sheet-ink-muted)' }}
                        >
                          ×
                        </button>
                      </header>
                    </section>
                  ))}
              </div>
            </DndContext>
          )}

          <datalist id="outline-act-suggestions">
            {distinctActs(beats).map(a => <option key={a} value={a} />)}
          </datalist>

          {(beats.length > 0 || pendingActs.length > 0) && (
            <button
              type="button"
              onClick={() => addBeat()}
              className="w-full mt-3 px-4 py-3 rounded-md text-sm font-semibold italic transition-colors flex items-center justify-center gap-2"
              style={{
                background: 'transparent',
                border: '1.5px dashed var(--sheet-rule)',
                color: 'var(--sheet-ink-muted)',
                fontFamily: 'var(--font-display)',
              }}
            >
              <Plus className="w-4 h-4" />
              Add a beat
            </button>
          )}

          {newActDraft !== null ? (
            <input
              autoFocus
              value={newActDraft}
              onChange={e => setNewActDraft(e.target.value)}
              onBlur={e => commitNewAct(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') { setNewActDraft(null) }
              }}
              placeholder="Act name"
              className="w-full mt-3 px-4 py-3 rounded-md text-sm font-semibold bg-transparent outline-none"
              style={{
                border: '1.5px dashed var(--color-brand)',
                color: 'var(--sheet-ink)',
                fontFamily: 'var(--font-display)',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setNewActDraft('')}
              className="w-full mt-3 px-4 py-3 rounded-md text-sm font-semibold italic transition-colors flex items-center justify-center gap-2"
              style={{
                background: 'transparent',
                border: '1.5px dashed var(--sheet-rule-soft)',
                color: 'var(--sheet-ink-muted)',
                fontFamily: 'var(--font-display)',
              }}
            >
              <Plus className="w-4 h-4" />
              New Act
            </button>
          )}
        </div>
      </div>

      {linkingBeatId && (
        <ChapterLinkPopover
          onPick={chapterId => {
            patchBeat(linkingBeatId, { linkedChapterId: chapterId })
          }}
          onClose={() => setLinkingBeatId(null)}
        />
      )}
    </main>
  )
}
