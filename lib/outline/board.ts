import { createId } from '@paralleldrive/cuid2'

export type OutlineCard = {
  id: string
  title: string
  synopsis?: string
  linkedChapterId?: string
}

export type OutlineColumn = {
  id: string
  title: string
  cards: OutlineCard[]
}

export type OutlineContent = {
  columns: OutlineColumn[]
}

// Returns the default starting board for a new outline item: three
// columns titled Act 1 / Act 2 / Act 3 with no cards.
export function seedOutline(): OutlineContent {
  return {
    columns: [
      { id: createId(), title: 'Act 1', cards: [] },
      { id: createId(), title: 'Act 2', cards: [] },
      { id: createId(), title: 'Act 3', cards: [] },
    ],
  }
}

// Pure move: relocates a card from one position to another. If the
// source card or target column is missing, returns the input unchanged.
export function moveCard(
  outline: OutlineContent,
  from: { columnId: string; cardId: string },
  to: { columnId: string; index: number },
): OutlineContent {
  const sourceCol = outline.columns.find(c => c.id === from.columnId)
  const targetCol = outline.columns.find(c => c.id === to.columnId)
  if (!sourceCol || !targetCol) return outline

  const card = sourceCol.cards.find(c => c.id === from.cardId)
  if (!card) return outline

  const nextColumns = outline.columns.map(col => {
    if (col.id === from.columnId && col.id === to.columnId) {
      // Same-column move: remove + reinsert at clamped index
      const filtered = col.cards.filter(c => c.id !== from.cardId)
      const insertAt = Math.min(Math.max(0, to.index), filtered.length)
      return { ...col, cards: [...filtered.slice(0, insertAt), card, ...filtered.slice(insertAt)] }
    }
    if (col.id === from.columnId) {
      return { ...col, cards: col.cards.filter(c => c.id !== from.cardId) }
    }
    if (col.id === to.columnId) {
      const insertAt = Math.min(Math.max(0, to.index), col.cards.length)
      return { ...col, cards: [...col.cards.slice(0, insertAt), card, ...col.cards.slice(insertAt)] }
    }
    return col
  })

  return { columns: nextColumns }
}

// Pure move: relocates a column to a new index. Out-of-range indices
// are clamped. Unknown columnId returns the input unchanged.
export function moveColumn(
  outline: OutlineContent,
  columnId: string,
  toIndex: number,
): OutlineContent {
  const fromIndex = outline.columns.findIndex(c => c.id === columnId)
  if (fromIndex < 0) return outline

  const next = [...outline.columns]
  const [col] = next.splice(fromIndex, 1)
  const clamped = Math.min(Math.max(0, toIndex), next.length)
  next.splice(clamped, 0, col)

  return { columns: next }
}
