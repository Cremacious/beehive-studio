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
  SortableContext, horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  type OutlineContent, type OutlineCard, type OutlineColumn,
  seedOutline, moveCard, moveColumn,
} from '@/lib/outline/board'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { OutlineColumnView } from './outline-column'
import { ChapterLinkPopover } from './chapter-link-popover'

type Props = { item: BinderItemRow }

export function OutlineBoard({ item }: Props) {
  const { binderItems, setActiveItemId, updateBinderItem } = useBookEditor()
  const [outline, setOutline] = useState<OutlineContent>(() => {
    const c = item.content as OutlineContent | null
    if (c && Array.isArray(c.columns)) return c
    return seedOutline()
  })
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const [linkingCardId, setLinkingCardId] = useState<{ columnId: string; cardId: string } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Persist seeded content for legacy items so subsequent reloads don't re-seed.
  useEffect(() => {
    const c = item.content as OutlineContent | null
    if (!c || !Array.isArray(c.columns)) {
      void updateBinderItemAction(item.id, { content: outline })
      updateBinderItem(item.id, { content: outline })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commit(next: OutlineContent) {
    setOutline(next)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      updateBinderItem(item.id, { content: next })
      const result = await updateBinderItemAction(item.id, { content: next })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  // ─── Column ops ────────────────────────────────────────────────────────────
  function addColumn() {
    commit({ columns: [...outline.columns, { id: createId(), title: 'New column', cards: [] }] })
  }
  function patchColumn(id: string, patch: Partial<OutlineColumn>) {
    commit({ columns: outline.columns.map(c => c.id === id ? { ...c, ...patch } : c) })
  }
  function deleteColumn(id: string) {
    commit({ columns: outline.columns.filter(c => c.id !== id) })
  }

  // ─── Card ops ──────────────────────────────────────────────────────────────
  function addCard(columnId: string) {
    commit({
      columns: outline.columns.map(c => c.id === columnId
        ? { ...c, cards: [...c.cards, { id: createId(), title: '' }] }
        : c),
    })
  }
  function patchCard(columnId: string, cardId: string, patch: Partial<OutlineCard>) {
    commit({
      columns: outline.columns.map(c => c.id === columnId
        ? { ...c, cards: c.cards.map(card => card.id === cardId ? { ...card, ...patch } : card) }
        : c),
    })
  }
  function deleteCard(columnId: string, cardId: string) {
    commit({
      columns: outline.columns.map(c => c.id === columnId
        ? { ...c, cards: c.cards.filter(card => card.id !== cardId) }
        : c),
    })
  }

  // ─── Drag and drop ─────────────────────────────────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Was a column dragged?
    const isColumnDrag = outline.columns.some(c => c.id === activeId)
    if (isColumnDrag) {
      const toIndex = outline.columns.findIndex(c => c.id === overId)
      if (toIndex < 0) return
      commit(moveColumn(outline, activeId, toIndex))
      return
    }

    // Otherwise it's a card drag. Find source column.
    const sourceCol = outline.columns.find(c => c.cards.some(card => card.id === activeId))
    if (!sourceCol) return

    // The over.id may be another card OR a column id (when dropping onto a column itself).
    const targetColAsCol = outline.columns.find(c => c.id === overId)
    if (targetColAsCol) {
      commit(moveCard(outline, { columnId: sourceCol.id, cardId: activeId }, { columnId: targetColAsCol.id, index: targetColAsCol.cards.length }))
      return
    }

    const targetCol = outline.columns.find(c => c.cards.some(card => card.id === overId))
    if (!targetCol) return
    const targetIndex = targetCol.cards.findIndex(c => c.id === overId)
    commit(moveCard(outline, { columnId: sourceCol.id, cardId: activeId }, { columnId: targetCol.id, index: targetIndex }))
  }

  // Chapter link helpers (popover wired in Task 4)
  function isChapterAvailable(chapterId: string | undefined): boolean {
    if (!chapterId) return false
    return binderItems.some(b => b.type === 'chapter' && b.chapterId === chapterId)
  }
  function jumpToChapter(chapterId: string) {
    const binderItem = binderItems.find(b => b.type === 'chapter' && b.chapterId === chapterId)
    if (binderItem) setActiveItemId(binderItem.id)
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
          <p className="text-[10px] text-muted-foreground">Outline · Kanban board</p>
        </div>
        <SaveStatusBadge status={saveStatus} />
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={outline.columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-start gap-4 h-full min-h-0">
              {outline.columns.map(col => (
                <OutlineColumnView
              key={col.id}
              column={col}
              onChange={patch => patchColumn(col.id, patch)}
              onDelete={() => deleteColumn(col.id)}
              onAddCard={() => addCard(col.id)}
              onCardChange={(cardId, patch) => patchCard(col.id, cardId, patch)}
              onCardDelete={cardId => deleteCard(col.id, cardId)}
              onCardOpenLinkPopover={cardId => setLinkingCardId({ columnId: col.id, cardId })}
              onCardUnlink={cardId => patchCard(col.id, cardId, { linkedChapterId: undefined })}
              onCardJumpToChapter={cardId => {
                const card = col.cards.find(c => c.id === cardId)
                if (card?.linkedChapterId) jumpToChapter(card.linkedChapterId)
              }}
              isChapterAvailable={isChapterAvailable}
            />
          ))}

              <button
                onClick={addColumn}
                className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg py-2 px-4 w-48 flex-shrink-0 self-start"
              >
                + Column
              </button>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {linkingCardId && (
        <ChapterLinkPopover
          onPick={chapterId => {
            patchCard(linkingCardId.columnId, linkingCardId.cardId, { linkedChapterId: chapterId })
          }}
          onClose={() => setLinkingCardId(null)}
        />
      )}
    </main>
  )
}
