import { z } from 'zod'

export const userTargetSchema = z.object({ targetUserId: z.string().min(1) })

export const claimInviteSchema = z.object({ token: z.string().min(16).max(64) })
