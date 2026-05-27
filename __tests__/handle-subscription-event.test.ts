import { describe, it, expect, vi, beforeEach } from 'vitest'

const findFirstMock = vi.hoisted(() => vi.fn())
const onConflictDoUpdateMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
)
const valuesMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock }),
)
const insertMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ values: valuesMock }),
)
const customersRetrieveMock = vi.hoisted(() => vi.fn())

vi.mock('@/db', () => ({
  db: {
    query: {
      userBilling: {
        findFirst: findFirstMock,
      },
    },
    insert: insertMock,
  },
}))

vi.mock('@/db/schema', () => ({
  userBilling: {
    stripeCustomerId: 'stripe_customer_id_col',
    userId: 'user_id_col',
  },
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    customers: {
      retrieve: customersRetrieveMock,
    },
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}))

import { handleSubscriptionEvent } from '@/lib/stripe/handle-subscription-event'

const baseSubscription = {
  id: 'sub_test_123',
  customer: 'cus_test_abc',
  status: 'active' as const,
  items: {
    data: [
      { current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 },
    ],
  },
}

beforeEach(() => {
  findFirstMock.mockReset()
  onConflictDoUpdateMock.mockReset().mockResolvedValue(undefined)
  valuesMock
    .mockClear()
    .mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock })
  insertMock.mockClear().mockReturnValue({ values: valuesMock })
  customersRetrieveMock.mockReset()
})

describe('handleSubscriptionEvent', () => {
  it('upserts userBilling using existing row userId when found', async () => {
    findFirstMock.mockResolvedValue({ userId: 'user_existing_1' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleSubscriptionEvent(baseSubscription as any)

    expect(customersRetrieveMock).not.toHaveBeenCalled()
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_existing_1',
        stripeCustomerId: 'cus_test_abc',
        stripeSubscriptionId: 'sub_test_123',
        subscriptionStatus: 'active',
      }),
    )
  })

  it('recovers via Stripe customer metadata when row is missing', async () => {
    findFirstMock.mockResolvedValue(undefined)
    customersRetrieveMock.mockResolvedValue({
      deleted: false,
      metadata: { userId: 'user_recovered_2' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleSubscriptionEvent(baseSubscription as any)

    expect(customersRetrieveMock).toHaveBeenCalledWith('cus_test_abc')
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_recovered_2',
      }),
    )
  })

  it('throws when recovery customer is missing metadata.userId', async () => {
    findFirstMock.mockResolvedValue(undefined)
    customersRetrieveMock.mockResolvedValue({
      deleted: false,
      metadata: {},
    })

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleSubscriptionEvent(baseSubscription as any),
    ).rejects.toThrow(/missing metadata\.userId/)
    expect(valuesMock).not.toHaveBeenCalled()
  })

  it('throws on unknown subscription status', async () => {
    findFirstMock.mockResolvedValue({ userId: 'user_x' })
    // 'paused' is now valid in the enum after Task 1's extension, so use an
    // obviously-invalid literal to verify the isKnownStatus guard.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub: any = { ...baseSubscription, status: 'foo_bar_unknown' }
    await expect(handleSubscriptionEvent(sub)).rejects.toThrow(
      /Unknown subscription status/,
    )
    expect(valuesMock).not.toHaveBeenCalled()
  })
})
