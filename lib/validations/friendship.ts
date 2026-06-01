import { z } from 'zod'

export const sendFriendRequestSchema = z.object({
  recipientId: z.string().min(1),
})

export const friendshipIdSchema = z.object({
  friendshipId: z.string().min(1),
})

export const unfriendSchema = z.object({
  otherUserId: z.string().min(1),
})

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>
export type FriendshipIdInput = z.infer<typeof friendshipIdSchema>
export type UnfriendInput = z.infer<typeof unfriendSchema>
