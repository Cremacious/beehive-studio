import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/db', () => ({
  db: {
    query: {
      books: { findFirst: vi.fn() },
      hives: { findFirst: vi.fn() },
      hiveMembers: { findFirst: vi.fn() },
      binderItems: { findFirst: vi.fn() },
    },
  },
}))

import { db } from '@/db'
import {
  canEditWiki, canSubmitChapter, canReviewSubmissions, canAnnotate,
  canSuggestEdits, canEditOutline, canManageMembers, canDeleteHive,
  requireBinderWritePermission,
  type HiveRole,
} from '../permissions'

const ROLES: HiveRole[] = ['OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER']

describe('hive permission predicates', () => {
  it('canEditWiki: everyone except BETA_READER', () => {
    expect(canEditWiki('OWNER')).toBe(true)
    expect(canEditWiki('MODERATOR')).toBe(true)
    expect(canEditWiki('CONTRIBUTOR')).toBe(true)
    expect(canEditWiki('BETA_READER')).toBe(false)
  })
  it('canSubmitChapter: CONTRIBUTOR only', () => {
    expect(canSubmitChapter('OWNER')).toBe(false)
    expect(canSubmitChapter('MODERATOR')).toBe(false)
    expect(canSubmitChapter('CONTRIBUTOR')).toBe(true)
    expect(canSubmitChapter('BETA_READER')).toBe(false)
  })
  it('canReviewSubmissions: OWNER or MODERATOR', () => {
    expect(canReviewSubmissions('OWNER')).toBe(true)
    expect(canReviewSubmissions('MODERATOR')).toBe(true)
    expect(canReviewSubmissions('CONTRIBUTOR')).toBe(false)
    expect(canReviewSubmissions('BETA_READER')).toBe(false)
  })
  it('canAnnotate: all roles', () => {
    for (const r of ROLES) expect(canAnnotate(r)).toBe(true)
  })
  it('canSuggestEdits: all roles', () => {
    for (const r of ROLES) expect(canSuggestEdits(r)).toBe(true)
  })
  it('canEditOutline: everyone except BETA_READER', () => {
    expect(canEditOutline('BETA_READER')).toBe(false)
    expect(canEditOutline('OWNER')).toBe(true)
    expect(canEditOutline('MODERATOR')).toBe(true)
    expect(canEditOutline('CONTRIBUTOR')).toBe(true)
  })
  it('canManageMembers: OWNER or MODERATOR', () => {
    expect(canManageMembers('OWNER')).toBe(true)
    expect(canManageMembers('MODERATOR')).toBe(true)
    expect(canManageMembers('CONTRIBUTOR')).toBe(false)
    expect(canManageMembers('BETA_READER')).toBe(false)
  })
  it('canDeleteHive: OWNER only', () => {
    expect(canDeleteHive('OWNER')).toBe(true)
    expect(canDeleteHive('MODERATOR')).toBe(false)
    expect(canDeleteHive('CONTRIBUTOR')).toBe(false)
    expect(canDeleteHive('BETA_READER')).toBe(false)
  })
})

const TT_ROLES = ['OWNER', 'MODERATOR', 'CONTRIBUTOR', 'BETA_READER'] as const
const TT_TYPES = [
  'chapter','part','front_matter','back_matter',
  'wiki_entry','wiki_folder','character','outline',
  'research_note','research_folder',
] as const

// Truth: rows = role, cols = type, true = write allowed.
const TRUTH: Record<string, Record<string, boolean>> = {
  OWNER:        { chapter:false,part:false,front_matter:false,back_matter:false, wiki_entry:true, wiki_folder:true, character:true,  outline:true,  research_note:true, research_folder:true },
  MODERATOR:    { chapter:false,part:false,front_matter:false,back_matter:false, wiki_entry:true, wiki_folder:true, character:true,  outline:true,  research_note:true, research_folder:true },
  CONTRIBUTOR:  { chapter:false,part:false,front_matter:false,back_matter:false, wiki_entry:true, wiki_folder:true, character:true,  outline:true,  research_note:true, research_folder:true },
  BETA_READER:  { chapter:false,part:false,front_matter:false,back_matter:false, wiki_entry:false,wiki_folder:false,character:false, outline:false, research_note:false,research_folder:false },
}

describe('requireBinderWritePermission — 4 hive roles × 10 item types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.query.books.findFirst as any).mockResolvedValue({ userId: 'author-id' })  // never the actor
    ;(db.query.hives.findFirst as any).mockResolvedValue({ id: 'hive-1' })
  })

  for (const role of TT_ROLES) {
    for (const type of TT_TYPES) {
      const allowed = TRUTH[role][type]
      it(`${role} x ${type} => ${allowed ? 'allow' : 'deny'}`, async () => {
        ;(db.query.hiveMembers.findFirst as any).mockResolvedValue({ role })
        ;(db.query.binderItems.findFirst as any).mockResolvedValue({ type, bookId: 'book-1' })
        const p = requireBinderWritePermission('book-1', 'item-1', 'user-1')
        if (allowed) await expect(p).resolves.toBeUndefined()
        else        await expect(p).rejects.toThrow('NOT_AUTHORIZED')
      })
    }
  }
})

describe('requireBinderWritePermission — author bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('book author is always allowed', async () => {
    ;(db.query.books.findFirst as any).mockResolvedValue({ userId: 'author-1' })
    await expect(requireBinderWritePermission('book-1', 'item-1', 'author-1')).resolves.toBeUndefined()
  })
  it('non-member non-author is denied', async () => {
    ;(db.query.books.findFirst as any).mockResolvedValue({ userId: 'author-1' })
    ;(db.query.hives.findFirst as any).mockResolvedValue({ id: 'hive-1' })
    ;(db.query.hiveMembers.findFirst as any).mockResolvedValue(undefined)
    await expect(requireBinderWritePermission('book-1', 'item-1', 'stranger')).rejects.toThrow('NOT_AUTHORIZED')
  })
})
