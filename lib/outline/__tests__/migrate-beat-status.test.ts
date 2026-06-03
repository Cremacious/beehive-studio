import { describe, expect, it } from 'vitest'
import { migrateBeatStatus, type LegacyBeat } from '../migrate-beat-status'

describe('migrateBeatStatus', () => {
  it('maps idea → yellow and drops status', () => {
    const input: LegacyBeat = { id: 'a', title: 't', status: 'idea' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBe('yellow')
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('maps drafting → orange and drops status', () => {
    const input: LegacyBeat = { id: 'a', title: 't', status: 'drafting' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBe('orange')
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('maps done → lime and drops status', () => {
    const input: LegacyBeat = { id: 'a', title: 't', status: 'done' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBe('lime')
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('leaves beats without status untouched', () => {
    const input: LegacyBeat = { id: 'a', title: 't' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBeUndefined()
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('does NOT overwrite an explicit color (idempotent)', () => {
    const input: LegacyBeat = { id: 'a', title: 't', status: 'idea', color: 'purple' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBe('purple')
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('preserves all other fields', () => {
    const input: LegacyBeat = {
      id: 'a',
      title: 't',
      description: 'd',
      status: 'idea',
      linkedChapterId: 'ch1',
      act: 'Act I',
    }
    const out = migrateBeatStatus(input)
    expect(out.id).toBe('a')
    expect(out.title).toBe('t')
    expect(out.description).toBe('d')
    expect(out.linkedChapterId).toBe('ch1')
    expect(out.act).toBe('Act I')
  })
})
