import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/db', () => ({
  db: { select: vi.fn() },
}))
vi.mock('@/lib/books/can-read', () => ({
  canReadBook: vi.fn(),
}))

import { getSeriesNeighbors } from '../get-series-neighbors'

type Row = {
  id: string
  title: string
  userId: string
  seriesName: string | null
  seriesNumber: number | null
}

async function mockBooksQuery(rows: Row[]) {
  const { db } = await import('@/db')
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      where: () => Promise.resolve(rows),
    }),
  })
}

async function mockCanRead(allowed: Set<string>) {
  const { canReadBook } = await import('@/lib/books/can-read')
  ;(canReadBook as ReturnType<typeof vi.fn>).mockImplementation(
    async (bookId: string) => (
      allowed.has(bookId)
        ? { ok: true }
        : { ok: false, reason: 'PRIVATE' }
    ),
  )
}

describe('getSeriesNeighbors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('book with no seriesName returns null neighbors', async () => {
    await mockBooksQuery([])
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b1', userId: 'u1', seriesName: null, seriesNumber: null },
      viewerUserId: 'u1',
    })
    expect(r).toEqual({ previous: null, next: null, total: 0 })
  })

  it('sole book in series returns null neighbors but total=1', async () => {
    await mockBooksQuery([
      { id: 'b1', title: 'Only', userId: 'u1', seriesName: 'Solo', seriesNumber: 1 },
    ])
    await mockCanRead(new Set(['b1']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b1', userId: 'u1', seriesName: 'Solo', seriesNumber: 1 },
      viewerUserId: 'u1',
    })
    expect(r).toEqual({ previous: null, next: null, total: 1 })
  })

  it('Book 2 with Book 1 + Book 3 visible returns both neighbors (normalized match)', async () => {
    await mockBooksQuery([
      { id: 'b1', title: 'Way of Kings', userId: 'u1', seriesName: 'The Stormlight Archive', seriesNumber: 1 },
      { id: 'b2', title: 'Words of Radiance', userId: 'u1', seriesName: 'Stormlight Archive', seriesNumber: 2 },
      { id: 'b3', title: 'Oathbringer', userId: 'u1', seriesName: 'THE STORMLIGHT ARCHIVE', seriesNumber: 3 },
    ])
    await mockCanRead(new Set(['b1', 'b2', 'b3']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b2', userId: 'u1', seriesName: 'Stormlight Archive', seriesNumber: 2 },
      viewerUserId: 'u1',
    })
    expect(r.previous?.id).toBe('b1')
    expect(r.next?.id).toBe('b3')
    expect(r.total).toBe(3)
  })

  it('Book 1 with only Book 3 visible (gap) jumps to Book 3', async () => {
    await mockBooksQuery([
      { id: 'b1', title: 'B1', userId: 'u1', seriesName: 'Saga', seriesNumber: 1 },
      { id: 'b3', title: 'B3', userId: 'u1', seriesName: 'Saga', seriesNumber: 3 },
    ])
    await mockCanRead(new Set(['b1', 'b3']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b1', userId: 'u1', seriesName: 'Saga', seriesNumber: 1 },
      viewerUserId: 'u1',
    })
    expect(r.previous).toBe(null)
    expect(r.next?.id).toBe('b3')
  })

  it('next book that viewer cannot read is omitted', async () => {
    await mockBooksQuery([
      { id: 'b1', title: 'B1', userId: 'u1', seriesName: 'Saga', seriesNumber: 1 },
      { id: 'b2', title: 'B2', userId: 'u1', seriesName: 'Saga', seriesNumber: 2 },
      { id: 'b3', title: 'B3 (private)', userId: 'u1', seriesName: 'Saga', seriesNumber: 3 },
    ])
    await mockCanRead(new Set(['b1', 'b2']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b2', userId: 'u1', seriesName: 'Saga', seriesNumber: 2 },
      viewerUserId: 'u1',
    })
    expect(r.previous?.id).toBe('b1')
    expect(r.next).toBe(null)
    expect(r.total).toBe(2)
  })

  it('current book with null seriesNumber returns null neighbors but total reflects visible books', async () => {
    await mockBooksQuery([
      { id: 'b1', title: 'B1', userId: 'u1', seriesName: 'Saga', seriesNumber: 1 },
      { id: 'b2', title: 'B2', userId: 'u1', seriesName: 'Saga', seriesNumber: null },
    ])
    await mockCanRead(new Set(['b1', 'b2']))
    const r = await getSeriesNeighbors({
      currentBook: { id: 'b2', userId: 'u1', seriesName: 'Saga', seriesNumber: null },
      viewerUserId: 'u1',
    })
    expect(r.previous).toBe(null)
    expect(r.next).toBe(null)
    expect(r.total).toBe(2)
  })
})
