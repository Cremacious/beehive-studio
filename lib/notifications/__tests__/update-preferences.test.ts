import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'u1'),
}))

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        query: {
          notificationPreferences: {
            findFirst: vi.fn().mockResolvedValue(undefined),
          },
        },
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      })
    ),
  },
}))

import * as actions from '../update-preferences'

describe('updateNotificationPreferenceAction', () => {
  it('exports the action with correct arity', () => {
    expect(typeof actions.updateNotificationPreferenceAction).toBe('function')
    expect(actions.updateNotificationPreferenceAction.length).toBe(1)
  })

  it('returns success when adding NEW_LIKE to empty preferences', async () => {
    const result = await actions.updateNotificationPreferenceAction({
      type: 'NEW_LIKE',
      optedOut: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.optedOutTypes).toContain('NEW_LIKE')
    }
  })

  it('returns INVALID_INPUT for unknown type', async () => {
    const result = await actions.updateNotificationPreferenceAction({
      type: 'BOGUS_TYPE',
      optedOut: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INVALID_INPUT')
    }
  })
})
