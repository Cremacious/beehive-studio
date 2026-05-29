'use client'

import { useRef, useState } from 'react'
import { createId } from '@paralleldrive/cuid2'
import Link from 'next/link'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove } from '@dnd-kit/sortable'
import { Plus, Search, X } from 'lucide-react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { groupBeatsByAct, distinctActs } from '@/lib/outline/group-by-act'
import { canEditOutline, type HiveRole } from '@/lib/hive/permissions'
import { SaveStatusBadge, type FormSaveStatus } from '@/app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/save-status-badge'
import { OutlineBeatRow } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card'
import { readBeats, type Beat, type BeatStatus, type OutlineContent } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'

const STATUS_CYCLE: BeatStatus[] = ['idea', 'drafting', 'done']
function nextStatus(s: BeatStatus | undefined): BeatStatus {
  const i = STATUS_CYCLE.indexOf((s ?? 'idea') as BeatStatus)
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]!
}

function relTime(d: Date): string {
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

type ChapterRef = { id: string; title: string; order: number }

type HiveOutlineData = {
  bookId: string
  outline: BinderItemRow | null
  chapters: ChapterRef[]
  viewerRole: HiveRole
  lastEditedByUsername: string | null
  lastEditedAt: Date | null
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
  if (!data.outline) {
    return (
      <main className="flex-1 flex items-center justify-center p-10">
        <div
          className="max-w-md text-center space-y-4 rounded-lg p-8"
          style={{
            background: 'var(--canvas-dark-100)',
            border: '1px solid var(--canvas-dark-300)',
          }}
        >
          <h2 className="font-comfortaa font-bold text-xl">No outline yet</h2>
          <p className="text-sm text-muted-foreground">
            This hive&apos;s book has no outline yet — the author can create one in the editor.
          </p>
          <Link
            href={`/${locale}/studio/${data.bookId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
            style={{
              background: 'var(--color-brand)',
              color: 'var(--brand-ink, oklch(0.18 0.02 60))',
            }}
          >
            Open the book in the studio
          </Link>
        </div>
      </main>
    )
  }

  return (
    <HiveOutlineSurfaceInner
      key={data.outline.id}
      outline={data.outline}
      chapters={data.chapters}
      viewerRole={data.viewerRole}
      lastEditedByUsername={data.lastEditedByUsername}
      lastEditedAt={data.lastEditedAt}
    />
  )
}

function HiveOutlineSurfaceInner({
  outline,
  chapters,
  viewerRole,
  lastEditedByUsername,
  lastEditedAt,
}: {
  outline: BinderItemRow
  chapters: ChapterRef[]
  viewerRole: HiveRole
  lastEditedByUsername: string | null
  lastEditedAt: Date | null
}) {
  const readOnly = !canEditOutline(viewerRole)
  const [beats, setBeats] = useState<Beat[]>(() => readBeats(outline.content))
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const [linkingBeatId, setLinkingBeatId] = useState<string | null>(null)
  const [pendingActs, setPendingActs] = useState<string[]>([])
  const [newActDraft, setNewActDraft] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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

  function addBeat(act?: string | null) {
    if (readOnly) return
    const resolvedAct = act !== undefined ? act : null
    commit([...beats, { id: createId(), title: '', description: '', status: 'idea', linkedChapterId: null, act: resolvedAct }])
    if (resolvedAct) setPendingActs(prev => prev.filter(a => a !== resolvedAct))
  }
  function patchBeat(id: string, patch: Partial<Beat>) {
    if (readOnly) return
    commit(beats.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  function deleteBeat(id: string) {
    if (readOnly) return
    commit(beats.filter(b => b.id !== id))
  }
  function cycleStatus(id: string) {
    if (readOnly) return
    const b = beats.find(x => x.id === id)
    if (!b) return
    patchBeat(id, { status: nextStatus(b.status) })
  }
  function renameAct(oldName: string | null, raw: string) {
    if (readOnly || oldName === null) return
    const newName = raw.trim()
    if (!newName || newName === oldName) return
    commit(beats.map(b => b.act === oldName ? { ...b, act: newName } : b))
  }
  function handleDragEnd(event: DragEndEvent) {
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
    <main
      data-slot="outline-pane"
      className="flex-1 flex flex-col overflow-hidden"
    >
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
        <span className="text-sm font-medium text-foreground/90 truncate">{outline.title}</span>
        <span className="text-[11px] text-muted-foreground/70">
          · {beats.length} beat{beats.length === 1 ? '' : 's'}
        </span>
        {lastEditedAt && (
          <span className="text-[11px] text-muted-foreground/70">
            · {lastEditedByUsername ? `Last edited by @${lastEditedByUsername} · ` : 'Last edited '}{relTime(lastEditedAt)}
          </span>
        )}
        <div className="flex-1" />
        {!readOnly && (
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
        )}
        <SaveStatusBadge status={saveStatus} />
      </header>

      <div
        data-slot="outline-pane-body"
        className="flex-1 overflow-y-auto"
        style={{ background: 'var(--sheet-canvas)' }}
      >
        <div className="mx-auto px-8 py-6" style={{ maxWidth: 760 }}>
          {beats.length === 0 && pendingActs.length === 0 && newActDraft === null ? (
            !readOnly ? (
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
              <p
                className="mt-4 text-center text-sm italic"
                style={{ color: 'var(--sheet-ink-muted)' }}
              >
                The outline is empty.
              </p>
            )
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
                        ) : readOnly ? (
                          <span
                            className="font-comfortaa font-bold text-base"
                            style={{ color: 'var(--sheet-ink)' }}
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
                            className="font-comfortaa font-bold text-base bg-transparent border-b border-transparent hover:border-border focus:border-brand outline-none"
                          />
                        )}
                        <span className="text-xs" style={{ color: 'var(--sheet-ink-muted)' }}>
                          {group.beats.length} beat{group.beats.length === 1 ? '' : 's'}
                        </span>
                        <div className="flex-1" />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => addBeat(group.act)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold"
                            style={{ color: 'var(--sheet-ink-muted)' }}
                          >
                            <Plus className="w-3 h-3" />
                            Add beat
                          </button>
                        )}
                      </header>
                      <SortableContext items={group.beats.map(b => b.id)}>
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
                                onOpenLinkPopover={() => { if (!readOnly) setLinkingBeatId(beat.id) }}
                                onUnlink={() => patchBeat(beat.id, { linkedChapterId: null })}
                                onJumpToChapter={() => { /* no studio context in hive view */ }}
                              />
                            )
                          })}
                        </div>
                      </SortableContext>
                    </section>
                  )
                })}
                {!readOnly && pendingActs
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

          <datalist id="hive-outline-act-suggestions">
            {distinctActs(beats).map(a => <option key={a} value={a} />)}
          </datalist>

          {!readOnly && (beats.length > 0 || pendingActs.length > 0) && (
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

          {!readOnly && (newActDraft !== null ? (
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
          ))}

          {readOnly && (
            <p
              className="mt-6 text-center text-xs"
              style={{ color: 'var(--sheet-ink-muted)' }}
            >
              Read-only — your role is Beta Reader.
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
    </main>
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
        className="rounded-lg shadow-2xl max-w-md w-full max-h-[60vh] flex flex-col"
        style={{
          width: 360,
          background: 'var(--canvas-dark-100, oklch(0.255 0.018 55))',
          border: '1px solid var(--canvas-dark-300, oklch(0.350 0.018 55))',
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-3 py-2.5"
          style={{ borderBottom: '1px solid var(--canvas-dark-300, oklch(0.350 0.018 55))' }}
        >
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

        <div className="px-3 pt-3 pb-2">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
            style={{
              background: 'var(--canvas-dark-200, oklch(0.290 0.018 55))',
              border: '1px solid var(--canvas-dark-300, oklch(0.350 0.018 55))',
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
          <p
            className="px-4 pb-4 text-xs italic"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {sorted.length === 0
              ? 'Standalone hive — no chapters available to link.'
              : 'No chapters match that search.'}
          </p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-0.5 px-2 pb-3">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => { onPick(c.id); onClose() }}
                className="text-left text-sm px-2.5 py-2 rounded transition-colors"
                style={{ color: 'var(--canvas-dark-ink)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--canvas-dark-200, oklch(0.290 0.018 55))' }}
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
