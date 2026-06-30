import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireAuthMock = vi.hoisted(() => vi.fn())
const checkoutRetrieveMock = vi.hoisted(() => vi.fn())
const upsertMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/lib/require-auth', () => ({ requireAuth: requireAuthMock }))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: { sessions: { retrieve: checkoutRetrieveMock } },
  },
}))

vi.mock('@/lib/stripe/sync-subscription', () => ({
  upsertUserBillingFromSubscription: upsertMock,
  // Keep the real premium-status semantics for the assertions below.
  statusGrantsPremium: (s: string | null | undefined) =>
    s === 'active' || s === 'trialing' || s === 'past_due',
}))

// billing.actions imports these but reconcile doesn't touch them.
vi.mock('@/db', () => ({ db: { query: { userBilling: { findFirst: vi.fn() } } } }))
vi.mock('@/db/schema', () => ({ userBilling: { userId: 'user_id_col', stripeCustomerId: 'cus_col' } }))
vi.mock('drizzle-orm', () => ({ eq: (col: unknown, val: unknown) => ({ col, val }) }))

import { reconcileCheckoutSessionAction } from '@/lib/actions/billing.actions'

beforeEach(() => {
  requireAuthMock.mockReset().mockResolvedValue('user_me')
  checkoutRetrieveMock.mockReset()
  upsertMock.mockReset().mockResolvedValue(undefined)
})

describe('reconcileCheckoutSessionAction', () => {
  it('upserts and reports premium for the caller’s own active checkout', async () => {
    checkoutRetrieveMock.mockResolvedValue({
      client_reference_id: 'user_me',
      subscription: { id: 'sub_1', customer: 'cus_1', status: 'active' },
    })

    const res = await reconcileCheckoutSessionAction({ sessionId: 'cs_1' })

    expect(res).toEqual({ success: true, data: { premium: true } })
    expect(upsertMock).toHaveBeenCalledWith(
      'user_me',
      expect.objectContaining({ id: 'sub_1' }),
    )
  })

  it('refuses to sync a checkout session belonging to another user', async () => {
    checkoutRetrieveMock.mockResolvedValue({
      client_reference_id: 'someone_else',
      subscription: { id: 'sub_2', customer: 'cus_2', status: 'active' },
    })

    const res = await reconcileCheckoutSessionAction({ sessionId: 'cs_2' })

    expect(res.success).toBe(false)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('reports not-yet-premium when the subscription is not attached', async () => {
    checkoutRetrieveMock.mockResolvedValue({
      client_reference_id: 'user_me',
      subscription: null,
    })

    const res = await reconcileCheckoutSessionAction({ sessionId: 'cs_3' })

    expect(res).toEqual({ success: true, data: { premium: false } })
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
