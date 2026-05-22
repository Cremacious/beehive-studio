import { describe, expect, it } from 'vitest'
import { beaconSaveSchema } from '@/app/api/chapter-save-beacon/schema'

describe('beaconSaveSchema', () => {
  it('accepts a valid TipTap doc payload', () => {
    const result = beaconSaveSchema.safeParse({
      chapterId: 'abc123',
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing chapterId', () => {
    const result = beaconSaveSchema.safeParse({
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty chapterId', () => {
    const result = beaconSaveSchema.safeParse({
      chapterId: '',
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-object content', () => {
    const result = beaconSaveSchema.safeParse({
      chapterId: 'abc',
      content: 'not an object',
    })
    expect(result.success).toBe(false)
  })

  it('rejects content without type:doc', () => {
    const result = beaconSaveSchema.safeParse({
      chapterId: 'abc',
      content: { type: 'paragraph' },
    })
    expect(result.success).toBe(false)
  })
})
