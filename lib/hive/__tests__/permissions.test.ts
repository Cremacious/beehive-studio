import { describe, it, expect } from 'vitest'
import {
  canEditWiki, canSubmitChapter, canReviewSubmissions, canAnnotate,
  canSuggestEdits, canEditOutline, canManageMembers, canDeleteHive,
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
