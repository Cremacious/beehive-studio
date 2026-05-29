import { describe, it, expect, vi, beforeEach } from 'vitest'

const { insertMock } = vi.hoisted(() => ({
  insertMock: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
}))
vi.mock('@/db', () => ({ db: { insert: insertMock } }))

import { recordHiveActivity } from '../record-activity'
import { hiveActivity } from '@/db/schema'

describe('recordHiveActivity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a row with the right shape', async () => {
    await recordHiveActivity({
      hiveId: 'h1',
      actorId: 'u1',
      type: 'member_joined',
      subjectId: null,
      payload: { foo: 'bar' },
    })
    expect(insertMock).toHaveBeenCalledWith(hiveActivity)
    expect(insertMock.mock.results[0].value.values).toHaveBeenCalledWith({
      hiveId: 'h1',
      actorId: 'u1',
      type: 'member_joined',
      subjectId: null,
      payload: { foo: 'bar' },
    })
  })
})
