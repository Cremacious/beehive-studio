export type BookRow = { id: string; [k: string]: unknown }

export type BackfillResult<T extends BookRow> = {
  books: T[]
  strictCount: number
}

const TARGET = 4

export function applyBackfill<T extends BookRow>(
  strict: T[],
  backfill: T[],
): BackfillResult<T> {
  if (strict.length >= TARGET) return { books: strict, strictCount: strict.length }
  const strictIds = new Set(strict.map((b) => b.id))
  const additions = backfill.filter((b) => !strictIds.has(b.id)).slice(0, TARGET - strict.length)
  return { books: [...strict, ...additions], strictCount: strict.length }
}
