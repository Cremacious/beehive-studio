'use client'

/* OutlineBoard — orchestrator for the Outline document.
 *
 * Composes: header strip · OutlineHelpBanner · OutlineActGroup[] ·
 * footer add-buttons · ChapterLinkPopover · OutlineHelpPanel.
 *
 * Owns: state, persistence (debounced 2s save), top-level DnD context
 * for both act-reorder and beat-move. Per-act SortableContexts for beat
 * order live inside each OutlineActGroup. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createId } from '@paralleldrive/cuid2'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { HelpCircle, Plus } from 'lucide-react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { ChapterLinkPopover } from './chapter-link-popover'
import { OutlineActGroup } from './outline-act-group'
import { OutlineHelpBanner } from './outline-help-banner'
import { OutlineHelpPanel } from './outline-help-panel'
import { BeatDialog } from './beat-dialog'
import { groupBeatsByAct, distinctActs } from '@/lib/outline/group-by-act'
import { migrateBeatStatus } from '@/lib/outline/migrate-beat-status'

// ── Types ──────────────────────────────────────────────────────────────

export type BeatStatus = 'idea' | 'drafting' | 'done'

export type BeatColor =
  | 'yellow' | 'orange' | 'pink' | 'purple'
  | 'blue' | 'mint' | 'lime' | 'slate'

export type BeatLabel =
  | 'character' | 'scene' | 'plot_point' | 'subplot'
  | 'world_building' | 'character_arc' | 'conflict' | 'note'

export type Beat = {
  id: string
  title: string
  description?: string
  color?: BeatColor | null
  label?: BeatLabel | null
  linkedChapterId?: string | null
  act?: string | null
  /** @deprecated read-only legacy; mapped to `color` by readContent() */
  status?: BeatStatus
}

export type ActKey = string | null  // null = "No Act"

export type OutlineContent = {
  beats: Beat[]
  actsOrder?: ActKey[]
  collapsedActs?: ActKey[]
  helpBannerDismissed?: boolean
}

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
  cards?: LegacyCard[]
}

export function readContent(raw: unknown): OutlineContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { beats: [] }
  }
  const c = raw as Partial<OutlineContent> & LegacyOutlineContent
  if (Array.isArray(c.beats)) {
    return {
      beats: c.beats.map(b => migrateBeatStatus(b as Beat) as Beat),
      actsOrder: c.actsOrder,
      collapsedActs: c.collapsedActs,
      helpBannerDismissed: c.helpBannerDismissed,
    }
  }
  if (Array.isArray(c.columns)) {
    const nestedCards: LegacyCard[] = c.columns.flatMap(col =>
      (col.cards ?? []).map(card => ({ ...card, columnId: card.columnId ?? col.id })),
    )
    const flatCards = Array.isArray(c.cards) ? c.cards : []
    const allCards: LegacyCard[] = nestedCards.length > 0 ? nestedCards : flatCards
    const colOrder = c.columns.map(col => col.id)
    return {
      beats: [...allCards]
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
        })),
    }
  }
  return { beats: [] }
}

/** Compatibility shim — external consumers (e.g. hive-outline-surface) call readBeats. */
export function readBeats(raw: unknown): Beat[] {
  return readContent(raw).beats
}

// ── Component ──────────────────────────────────────────────────────────

type Props = { item: BinderItemRow }

export function OutlineBoard({ item }: Props) {
  const { binderItems, setActiveItemId, updateBinderItem } = useBookEditor()
  const initial = useMemo(() => readContent(item.content), [item.id])
  const [beats, setBeats] = useState<Beat[]>(initial.beats)
  const [actsOrder, setActsOrder] = useState<ActKey[]>(initial.actsOrder ?? deriveActsOrder(initial.beats))
  const [collapsedActs, setCollapsedActs] = useState<ActKey[]>(initial.collapsedActs ?? [])
  const [helpBannerDismissed, setHelpBannerDismissed] = useState<boolean>(initial.helpBannerDismissed ?? false)
  const [helpPanelOpen, setHelpPanelOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const [linkingBeatId, setLinkingBeatId] = useState<string | null>(null)
  type DialogState =
    | { mode: 'closed' }
    | { mode: 'create'; defaultAct: string | null }
    | { mode: 'edit'; beatId: string }
  const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function openCreate(act: string | null = null) {
    setDialogState({ mode: 'create', defaultAct: act })
  }
  function openEdit(beat: Beat) {
    setDialogState({ mode: 'edit', beatId: beat.id })
  }
  function closeDialog() {
    setDialogState({ mode: 'closed' })
  }

  // CRITICAL: re-seed all state when the user switches to a different
  // outline document. The parent passes `<OutlineBoard item={...} />` without
  // a remounting `key`, so useState would otherwise hold the PRIOR doc's
  // beats — every keystroke would then overwrite the newly-opened doc's
  // content with the old doc's state on the next debounced save. Detect the
  // id flip in render and resync atomically (React's "adjusting state when
  // a prop changes" pattern).
  const [trackedItemId, setTrackedItemId] = useState(item.id)
  if (trackedItemId !== item.id) {
    setTrackedItemId(item.id)
    setBeats(initial.beats)
    setActsOrder(initial.actsOrder ?? deriveActsOrder(initial.beats))
    setCollapsedActs(initial.collapsedActs ?? [])
    setHelpBannerDismissed(initial.helpBannerDismissed ?? false)
    setSaveStatus('idle')
    setLinkingBeatId(null)
    setDialogState({ mode: 'closed' })
    setHelpPanelOpen(false)
    // Do NOT clear saveTimer — its closure captured the PRIOR item.id and
    // content, so letting it fire correctly persists pending edits to the
    // outline the user just navigated away from.
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // First-open migration — runs once per item.id so newly opened docs that
  // never had OutlineContent written get the flat shape persisted.
  const migrationRanFor = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (migrationRanFor.current.has(item.id)) return
    migrationRanFor.current.add(item.id)
    const c = item.content as Partial<OutlineContent> | null
    if (!c || !Array.isArray(c.beats)) {
      const next: OutlineContent = {
        beats: initial.beats,
        actsOrder: initial.actsOrder ?? deriveActsOrder(initial.beats),
        collapsedActs: initial.collapsedActs ?? [],
        helpBannerDismissed: initial.helpBannerDismissed ?? false,
      }
      void updateBinderItemAction(item.id, { content: next })
      updateBinderItem(item.id, { content: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  function commit(partial: Partial<OutlineContent>) {
    const nextBeats = partial.beats ?? beats
    const nextActsOrder = partial.actsOrder ?? actsOrder
    const nextCollapsed = partial.collapsedActs ?? collapsedActs
    const nextDismissed = partial.helpBannerDismissed ?? helpBannerDismissed
    setBeats(nextBeats)
    setActsOrder(nextActsOrder)
    setCollapsedActs(nextCollapsed)
    setHelpBannerDismissed(nextDismissed)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const content: OutlineContent = {
      beats: nextBeats,
      actsOrder: nextActsOrder,
      collapsedActs: nextCollapsed,
      helpBannerDismissed: nextDismissed,
    }
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      updateBinderItem(item.id, { content })
      const result = await updateBinderItemAction(item.id, { content })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  function ensureActInOrder(act: ActKey, current: ActKey[]): ActKey[] {
    if (current.some(a => a === act)) return current
    return [...current, act]
  }

  function patchBeat(id: string, patch: Partial<Beat>) {
    commit({ beats: beats.map(b => b.id === id ? { ...b, ...patch } : b) })
  }

  function renameAct(oldName: string, raw: string) {
    const newName = raw.trim()
    if (!newName || newName === oldName) return
    commit({
      beats: beats.map(b => b.act === oldName ? { ...b, act: newName } : b),
      actsOrder: actsOrder.map(a => a === oldName ? newName : a),
      collapsedActs: collapsedActs.map(a => a === oldName ? newName : a),
    })
  }

  function toggleActCollapsed(act: ActKey) {
    const next = collapsedActs.some(a => a === act)
      ? collapsedActs.filter(a => a !== act)
      : [...collapsedActs, act]
    commit({ collapsedActs: next })
  }

  function addNewAct() {
    let n = 1
    const existing = new Set(actsOrder.filter((a): a is string => typeof a === 'string'))
    while (existing.has(`Act ${n}`)) n++
    const name = `Act ${n}`
    commit({ actsOrder: ensureActInOrder(name, actsOrder) })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('__act__:') && overId.startsWith('__act__:')) {
      const a = parseActId(activeId)
      const b = parseActId(overId)
      const from = actsOrder.findIndex(x => x === a)
      const to = actsOrder.findIndex(x => x === b)
      if (from < 0 || to < 0) return
      commit({ actsOrder: arrayMove(actsOrder, from, to) })
      return
    }

    if (overId.startsWith('__acthead__:')) {
      const targetAct = parseActHead(overId)
      moveBeatToAct(activeId, targetAct)
      return
    }

    if (overId.startsWith('__actbody__:')) {
      const targetAct = parseActBody(overId)
      moveBeatToAct(activeId, targetAct)
      return
    }

    if (overId.startsWith('__empty__:')) {
      const targetAct = parseEmptyId(overId)
      moveBeatToAct(activeId, targetAct)
      return
    }

    const from = beats.findIndex(b => b.id === activeId)
    const to = beats.findIndex(b => b.id === overId)
    if (from < 0 || to < 0) return
    const targetAct = beats[to]!.act ?? null
    let next = arrayMove(beats, from, to)
    if ((next[to]!.act ?? null) !== targetAct) {
      next = next.map((b, i) => i === to ? { ...b, act: targetAct } : b)
    }
    commit({ beats: next })
  }

  function parseActId(id: string): ActKey {
    const raw = id.slice('__act__:'.length)
    return raw === '__noact__' ? null : raw
  }
  function parseActHead(id: string): ActKey {
    const raw = id.slice('__acthead__:'.length)
    return raw === '__noact__' ? null : raw
  }
  function parseActBody(id: string): ActKey {
    const raw = id.slice('__actbody__:'.length)
    return raw === '__noact__' ? null : raw
  }
  function parseEmptyId(id: string): ActKey {
    const raw = id.slice('__empty__:'.length)
    return raw === '__noact__' ? null : raw
  }

  function moveBeatToAct(beatId: string, targetAct: ActKey) {
    const beat = beats.find(b => b.id === beatId)
    if (!beat) return
    const others = beats.filter(b => b.id !== beatId)
    const firstIdxInTarget = others.findIndex(b => (b.act ?? null) === targetAct)
    const insertAt = firstIdxInTarget >= 0 ? firstIdxInTarget : others.length
    const moved = { ...beat, act: targetAct }
    const next = [...others.slice(0, insertAt), moved, ...others.slice(insertAt)]
    commit({
      beats: next,
      actsOrder: ensureActInOrder(targetAct, actsOrder),
    })
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

  const editingBeat: Beat | null =
    dialogState.mode === 'edit'
      ? beats.find(b => b.id === dialogState.beatId) ?? null
      : null

  const groups = useMemo(() => groupBeatsByAct(beats, actsOrder), [beats, actsOrder])
  const actIds = groups.map(g => `__act__:${g.act ?? '__noact__'}`)

  const beatStartIndexByAct = useMemo(() => {
    const map = new Map<ActKey, number>()
    let i = 1
    for (const g of groups) {
      map.set(g.act, i)
      i += g.beats.length
    }
    return map
  }, [groups])

  return (
    <main
      data-slot="outline-pane"
      key={item.id}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <style>{`
        [data-slot="outline-pane"] {
          --outline-canvas:      var(--canvas-dark-200);
          --outline-act-cap-bg:  var(--canvas-dark-300);
          --outline-drawer-bg:   var(--canvas-dark-100);
          --outline-rule:        oklch(1 0 0 / 0.06);
          --outline-rule-soft:   oklch(1 0 0 / 0.04);
          --outline-ink-strong:  var(--canvas-dark-ink-strong);
          --outline-ink:         var(--canvas-dark-ink);
          --outline-ink-muted:   oklch(from var(--canvas-dark-ink) l c h / 0.7);
          --outline-strip-bg:    var(--canvas-dark-100);
          --outline-strip-ink:   var(--canvas-dark-ink-strong);
          --outline-strip-ink-muted: oklch(from var(--canvas-dark-ink) l c h / 0.7);
        }
        [data-editor-theme="light"] [data-slot="outline-pane"] {
          --outline-canvas:      var(--paper-200);
          /* Warmer, slightly darker tan than --outline-canvas so each act
             header reads as its own band against the page. Sits between
             --paper-200 and --paper-300 with a touch more chroma. */
          --outline-act-cap-bg:  oklch(0.905 0.032 70);
          --outline-drawer-bg:   var(--paper-50);
          --outline-rule:        var(--paper-300);
          --outline-rule-soft:   oklch(from var(--paper-300) l c h / 0.6);
          --outline-ink-strong:  oklch(0.180 0.022 50);
          --outline-ink:         oklch(0.265 0.020 55);
          --outline-ink-muted:   oklch(0.520 0.022 60);
          /* Restore paper-* ink tokens to native values — defends against
             dark-mode remap leaks elsewhere in the cascade. */
          --paper-ink-strong:    oklch(0.180 0.022 50);
          --paper-ink:           oklch(0.265 0.020 55);
          --paper-ink-muted:     oklch(0.520 0.022 60);
          --paper-100:           oklch(0.965 0.018 85);
          /* Light-mode beat colors — darker, more saturated to read on
             paper-200 cream canvas. */
          --beat-yellow: oklch(0.70 0.18 85);
          --beat-orange: oklch(0.65 0.18 50);
          --beat-pink:   oklch(0.65 0.18 0);
          --beat-purple: oklch(0.58 0.20 295);
          --beat-blue:   oklch(0.55 0.18 245);
          --beat-mint:   oklch(0.60 0.14 165);
          --beat-lime:   oklch(0.65 0.16 130);
          --beat-slate:  oklch(0.50 0.04 250);
          /* Strip stays dark in both themes (matches Notes pattern). */
          --outline-strip-bg:    var(--canvas-dark-100);
          --outline-strip-ink:   var(--canvas-dark-ink-strong);
          --outline-strip-ink-muted: oklch(from var(--canvas-dark-ink) l c h / 0.7);
        }
      `}</style>

      <header
        data-slot="outline-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          background: 'var(--outline-strip-bg)',
          borderBottom: '1px solid oklch(1 0 0 / 0.06)',
          boxShadow: 'inset 0 1px 2px oklch(0 0 0 / 0.18)',
          color: 'var(--outline-strip-ink)',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: 2,
            background: 'oklch(0.68 0.10 200)',
          }}
        />
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--outline-strip-ink-muted)',
        }}>
          Outline
        </span>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: 'var(--outline-strip-ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title}
        </span>
        <span style={{
          fontSize: 11, color: 'var(--outline-strip-ink-muted)',
        }}>
          · {beats.length} beat{beats.length === 1 ? '' : 's'}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setHelpPanelOpen(true)}
          aria-label="Open outline help"
          title="How outlines work"
          style={{
            width: 32, height: 32,
            display: 'grid', placeItems: 'center',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--outline-strip-ink-muted)',
            border: '1px solid oklch(1 0 0 / 0.08)',
            cursor: 'pointer',
          }}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <SaveStatusBadge status={saveStatus} />
      </header>

      <div
        data-slot="outline-pane-body"
        className="flex-1 overflow-y-auto"
        style={{
          background: 'var(--outline-canvas)',
          color: 'var(--outline-ink)',
        }}
      >
        <div className="mx-auto px-8 py-6" style={{ maxWidth: 760 }}>
          <OutlineHelpBanner
            beatCount={beats.length}
            dismissed={helpBannerDismissed}
            onDismiss={() => commit({ helpBannerDismissed: true })}
          />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={actIds} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {groups.map(group => (
                  <OutlineActGroup
                    key={group.act ?? '__noact__'}
                    actKey={group.act}
                    beats={group.beats}
                    startIndex={beatStartIndexByAct.get(group.act) ?? 1}
                    collapsed={collapsedActs.some(a => a === group.act)}
                    onToggleCollapsed={() => toggleActCollapsed(group.act)}
                    onRenameAct={renameAct}
                    onAddBeat={() => openCreate(group.act)}
                    onEditBeat={openEdit}
                    onOpenLinkPopover={id => setLinkingBeatId(id)}
                    onUnlink={id => patchBeat(id, { linkedChapterId: null })}
                    onJumpToChapter={jumpToChapter}
                    chapterAvailable={isChapterAvailable}
                    chapterTitle={chapterTitleFor}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <datalist id="outline-act-suggestions">
            {distinctActs(beats).map(a => <option key={a} value={a} />)}
          </datalist>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => openCreate(null)}
              style={footerBtnStyle}
            >
              <Plus className="w-4 h-4" />
              Add a beat
            </button>
            <button
              type="button"
              onClick={addNewAct}
              style={footerBtnStyle}
            >
              <Plus className="w-4 h-4" />
              New Act
            </button>
          </div>
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

      <OutlineHelpPanel
        open={helpPanelOpen}
        onClose={() => setHelpPanelOpen(false)}
        onShowBannerAgain={() => commit({ helpBannerDismissed: false })}
      />

      <BeatDialog
        open={dialogState.mode !== 'closed'}
        mode={dialogState.mode === 'edit' ? 'edit' : 'create'}
        initial={editingBeat ?? {}}
        defaultAct={dialogState.mode === 'create' ? dialogState.defaultAct : null}
        onOpenChange={open => { if (!open) closeDialog() }}
        onSave={patch => {
          if (dialogState.mode === 'create') {
            const id = createId()
            const newBeat: Beat = {
              id,
              title: patch.title ?? '',
              description: patch.description,
              color: patch.color,
              label: patch.label,
              act: dialogState.defaultAct,
              linkedChapterId: null,
            }
            commit({
              beats: [...beats, newBeat],
              actsOrder: ensureActInOrder(dialogState.defaultAct, actsOrder),
            })
          } else if (dialogState.mode === 'edit' && editingBeat) {
            const editingId = editingBeat.id
            const next = beats.map(b =>
              b.id === editingId
                ? { ...b, ...patch }
                : b,
            )
            commit({ beats: next })
          }
        }}
        onDelete={
          dialogState.mode === 'edit' && editingBeat
            ? () => {
                const editingId = editingBeat.id
                commit({ beats: beats.filter(b => b.id !== editingId) })
              }
            : undefined
        }
      />
    </main>
  )
}

const footerBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 14px',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--outline-ink-muted)',
  border: '1.5px dashed var(--outline-rule-soft)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontStyle: 'italic',
  fontFamily: 'var(--font-display, inherit)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 44,
}

function deriveActsOrder(beats: Beat[]): ActKey[] {
  const seen = new Set<ActKey>()
  const order: ActKey[] = []
  for (const b of beats) {
    const key = ((b.act ?? '').trim() || null) as ActKey
    if (seen.has(key)) continue
    seen.add(key)
    if (key !== null) order.push(key)
  }
  if (beats.some(b => !(b.act ?? '').trim())) order.push(null)
  return order
}
