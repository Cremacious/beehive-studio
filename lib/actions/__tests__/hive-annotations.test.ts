import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mocking ─────────────────────────────────────────────────────────────
const insertCalls: Array<{ table: string; values: any }> = []
const updateCalls: Array<{ table: string; values: any }> = []

function tableName(table: any): string {
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name')
    if (sym) return (table as any)[sym]
  }
  return '<unknown>'
}

// Tx insert returns a chainable {values, returning} mock.
const txInsert = vi.fn((table: any) => {
  const tName = tableName(table)
  const captured: any = {}
  const valuesFn = vi.fn((values: any) => {
    insertCalls.push({ table: tName, values })
    captured.values = values
    const returningFn = vi.fn(async () => [{ id: 'new-ann-id' }])
    return { returning: returningFn, then: (cb: any) => cb(undefined) }
  })
  return { values: valuesFn }
})

const txUpdate = vi.fn((table: any) => {
  const tName = tableName(table)
  return {
    set: vi.fn((values: any) => {
      updateCalls.push({ table: tName, values })
      return {
        where: vi.fn(async () => undefined),
      }
    }),
  }
})

const hivesFindFirst = vi.fn<(a: any) => any>()
const chaptersFindFirst = vi.fn<(a: any) => any>()
const booksFindFirst = vi.fn<(a: any) => any>()
const annotationsFindFirst = vi.fn<(a: any) => any>()
const annotationsFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])
const profilesFindMany = vi.fn<(a: any) => Promise<any[]>>(async () => [])

vi.mock('@/db', () => ({
  db: {
    query: {
      hives: { findFirst: (a: any) => hivesFindFirst(a) },
      chapters: { findFirst: (a: any) => chaptersFindFirst(a) },
      books: { findFirst: (a: any) => booksFindFirst(a) },
      hiveAnnotations: {
        findFirst: (a: any) => annotationsFindFirst(a),
        findMany: (a: any) => annotationsFindMany(a),
      },
      userProfiles: {
        findMany: (a: any) => profilesFindMany(a),
      },
    },
    insert: (table: any) => {
      // top-level (non-tx) insert
      const tName = tableName(table)
      return {
        values: vi.fn((values: any) => {
          insertCalls.push({ table: tName, values })
          return {
            returning: vi.fn(async () => [{ id: 'new-ann-id' }]),
          }
        }),
      }
    },
    update: (table: any) => txUpdate(table),
    transaction: vi.fn(async (fn: any) => {
      return await fn({ insert: txInsert, update: txUpdate })
    }),
  },
}))

const requireAuthMock = vi.fn(async () => 'user-1')
vi.mock('@/lib/require-auth', () => ({
  requireAuth: () => requireAuthMock(),
}))

const requireHiveMemberMock = vi.fn<(h: string, u: string) => Promise<string>>(async () => 'CONTRIBUTOR')
vi.mock('@/lib/hive/permissions', async () => {
  const actual: any = await vi.importActual('@/lib/hive/permissions')
  return {
    ...actual,
    requireHiveMember: (hiveId: string, userId: string) =>
      requireHiveMemberMock(hiveId, userId),
  }
})

// ── Imports under test ──────────────────────────────────────────────────────
import {
  createAnnotationAction,
  replyToAnnotationAction,
  resolveAnnotationAction,
} from '../hive-annotations.actions'
import { canAnnotate, type HiveRole } from '@/lib/hive/permissions'
import { patchDocWithMark } from '@/lib/tiptap-extensions/patch-mark'
import { findMarkRanges, type PMNode } from '@/lib/tiptap-extensions/mark-scanning'

beforeEach(() => {
  insertCalls.length = 0
  updateCalls.length = 0
  vi.clearAllMocks()
  requireAuthMock.mockResolvedValue('user-1')
  requireHiveMemberMock.mockResolvedValue('CONTRIBUTOR')
  hivesFindFirst.mockResolvedValue({ bookId: 'book-1' })
  chaptersFindFirst.mockResolvedValue({
    id: 'ch-1',
    bookId: 'book-1',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world this is prose.' }],
        },
      ],
    },
  })
  booksFindFirst.mockResolvedValue({ userId: 'author-user' })
  annotationsFindFirst.mockResolvedValue(null)
  annotationsFindMany.mockResolvedValue([])
  profilesFindMany.mockResolvedValue([])
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('createAnnotationAction — H3 T6', () => {
  it('happy path: creates annotation row + writes hive_activity event', async () => {
    const r = await createAnnotationAction({
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      layer: 'GRAMMAR',
      body: 'typo here',
      selectionStart: 0,
      selectionEnd: 5,
      selectedText: 'Hello',
    })
    expect(r.success).toBe(true)

    const annInsert = insertCalls.find((c) => c.table === 'hive_annotations')
    const actInsert = insertCalls.find((c) => c.table === 'hive_activity')
    expect(annInsert).toBeDefined()
    expect(actInsert).toBeDefined()
    expect(annInsert!.values).toMatchObject({
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      authorId: 'user-1',
      layer: 'GRAMMAR',
      body: 'typo here',
      selectedText: 'Hello',
    })
    expect(actInsert!.values.type).toBe('annotation_added')
    expect(actInsert!.values.payload).toMatchObject({
      chapterId: 'ch-1',
      layer: 'GRAMMAR',
      excerpt: 'Hello',
    })

    // chapter content updated
    const chUpdate = updateCalls.find((c) => c.table === 'chapters')
    expect(chUpdate).toBeDefined()
  })

  it('non-member is blocked — returns NOT_AUTHORIZED, no inserts', async () => {
    requireHiveMemberMock.mockRejectedValueOnce(new Error('NOT_HIVE_MEMBER'))
    const r = await createAnnotationAction({
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      layer: 'GENERAL',
      body: 'note',
      selectionStart: 0,
      selectionEnd: 5,
    })
    expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
    expect(insertCalls.find((c) => c.table === 'hive_annotations')).toBeUndefined()
    expect(insertCalls.find((c) => c.table === 'hive_activity')).toBeUndefined()
  })

  it('sentinel: canAnnotate is true for every role today (flips red on future tightening)', () => {
    const roles: HiveRole[] = ['OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER']
    for (const role of roles) {
      expect(canAnnotate(role)).toBe(true)
    }
  })
})

describe('replyToAnnotationAction — H3 T6', () => {
  it('inserts the reply row but does NOT fire an activity event', async () => {
    annotationsFindFirst.mockResolvedValueOnce({
      id: 'parent-1',
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      layer: 'PLOT',
      parentId: null,
    })

    const r = await replyToAnnotationAction({ parentId: 'parent-1', body: 'agreed' })
    expect(r.success).toBe(true)

    const annInsert = insertCalls.find((c) => c.table === 'hive_annotations')
    expect(annInsert).toBeDefined()
    expect(annInsert!.values).toMatchObject({
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      parentId: 'parent-1',
      layer: 'PLOT',
      body: 'agreed',
      selectionStart: null,
      selectionEnd: null,
      selectedText: null,
    })

    const actInsert = insertCalls.find((c) => c.table === 'hive_activity')
    expect(actInsert).toBeUndefined()
  })
})

describe('resolveAnnotationAction — H3 T6', () => {
  function mockAnnotation(authorId: string) {
    annotationsFindFirst.mockResolvedValueOnce({
      id: 'ann-1',
      hiveId: 'hive-1',
      chapterId: 'ch-1',
      authorId,
    })
  }

  it('denies resolve for non-author + non-bookOwner', async () => {
    mockAnnotation('some-other-user')
    booksFindFirst.mockResolvedValueOnce({ userId: 'author-user' })
    requireAuthMock.mockResolvedValueOnce('viewer-user')

    const r = await resolveAnnotationAction('ann-1')
    expect(r).toEqual({ success: false, error: 'NOT_AUTHORIZED' })
    expect(updateCalls.find((c) => c.table === 'hive_annotations')).toBeUndefined()
  })

  it('allows resolve for the annotation author', async () => {
    mockAnnotation('user-1')
    booksFindFirst.mockResolvedValueOnce({ userId: 'author-user' })
    requireAuthMock.mockResolvedValueOnce('user-1')

    const r = await resolveAnnotationAction('ann-1')
    expect(r.success).toBe(true)
    const u = updateCalls.find((c) => c.table === 'hive_annotations')
    expect(u).toBeDefined()
    expect(u!.values).toMatchObject({ resolved: true, resolvedBy: 'user-1' })
  })

  it('allows resolve for the book owner', async () => {
    mockAnnotation('some-other-user')
    booksFindFirst.mockResolvedValueOnce({ userId: 'book-owner' })
    requireAuthMock.mockResolvedValueOnce('book-owner')

    const r = await resolveAnnotationAction('ann-1')
    expect(r.success).toBe(true)
    const u = updateCalls.find((c) => c.table === 'hive_annotations')
    expect(u).toBeDefined()
    expect(u!.values).toMatchObject({ resolved: true, resolvedBy: 'book-owner' })
  })
})

// ── patchDocWithMark unit tests ─────────────────────────────────────────────

describe('patchDocWithMark — H3 T6', () => {
  it('simple range: adds mark to a slice of one text node', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    }
    // PM positions: doc=0, p_open=1, "Hello"=1..6, " world"=6..12, p_close=12.
    // Marking "Hello" → PM 1..6.
    const out = patchDocWithMark(doc, 'hiveAnnotation', { annotationId: 'a1' }, 1, 6)
    const ranges = findMarkRanges(out, 'hiveAnnotation')
    expect(ranges.length).toBe(1)
    // findMarkRanges still reports text offsets (it only walks text nodes).
    expect(ranges[0]).toMatchObject({ from: 0, to: 5, attrs: { annotationId: 'a1' } })

    // Verify the doc structure: paragraph should now have a "Hello" marked + " world" unmarked
    const para = out.content![0]
    expect(para.content!.length).toBe(2)
    expect(para.content![0].text).toBe('Hello')
    expect(para.content![1].text).toBe(' world')
  })

  it('range spanning two text nodes: each gets the new mark', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world!' },
          ],
        },
      ],
    }
    // PM positions: doc=0, p_open=1, "Hello "=1..7, "world!"=7..13, p_close=13.
    // "lo wo" spans both text nodes — PM 4..9. findMarkRanges still reports
    // contiguous text-offset ranges; 3..8 covers "lo wo" in text-only coords.
    const out = patchDocWithMark(doc, 'hiveAnnotation', { annotationId: 'a1' }, 4, 9)
    const ranges = findMarkRanges(out, 'hiveAnnotation')
    expect(ranges.length).toBe(1)
    expect(ranges[0]).toMatchObject({ from: 3, to: 8 })

    // Ensure each affected text node carries the mark on its sliced piece.
    const para = out.content![0]
    const markedPieces = para.content!.filter((c) =>
      c.marks?.some((m) => m.type === 'hiveAnnotation'),
    )
    expect(markedPieces.length).toBe(2)
  })

  it('preserves existing marks (bold survives, annotation rides alongside)', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold text',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    }
    // PM positions: doc=0, p_open=1, "bold text"=1..10, p_close=10.
    // Marking "bold" → PM 1..5.
    const out = patchDocWithMark(doc, 'hiveAnnotation', { annotationId: 'a1' }, 1, 5)
    const para = out.content![0]
    const piece = para.content![0]
    expect(piece.text).toBe('bold')
    const markTypes = piece.marks?.map((m) => m.type).sort()
    expect(markTypes).toEqual(['bold', 'hiveAnnotation'])
    // Tail keeps bold but no annotation
    const tail = para.content![1]
    expect(tail.text).toBe(' text')
    expect(tail.marks?.map((m) => m.type)).toEqual(['bold'])
  })

  it('handles inline atoms (hardBreak) — selection past the atom lands on the right text', () => {
    // This is the regression that caused new annotations to surface as
    // orphaned immediately: when the doc has hardBreaks (or other leaf inline
    // atoms), each one consumes ONE PM position with no text contribution.
    // A naive text-offset walker treats hardBreak as a container (+2) and
    // the PM/text-offset mismatch grows linearly with atom count; the mark
    // either lands in the wrong range or falls outside any text node.
    const doc: PMNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Line one' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Line two' },
          ],
        },
      ],
    }
    // PM positions: doc=0, p_open=1, "Line one"=1..9, hardBreak=9..10,
    // "Line two"=10..18, p_close=18.
    // Marking "Line two" → PM 10..18.
    const out = patchDocWithMark(doc, 'hiveAnnotation', { annotationId: 'a1' }, 10, 18)
    const ranges = findMarkRanges(out, 'hiveAnnotation')
    expect(ranges.length).toBe(1)
    // findMarkRanges reports text offsets; "Line one"=0..8, hardBreak=0,
    // "Line two"=8..16. Marked range "Line two" → text 8..16.
    expect(ranges[0]).toMatchObject({ from: 8, to: 16 })

    // The hardBreak should still be present, unmarked.
    const para = out.content![0]
    const hb = para.content!.find((c) => c.type === 'hardBreak')
    expect(hb).toBeDefined()
    expect(hb!.marks).toBeUndefined()
  })
})
