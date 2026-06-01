import { z } from 'zod'

export const wordGoalTypeSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'TOTAL'])

export const createWordGoalSchema = z.object({
  hiveId: z.string().min(1),
  type: wordGoalTypeSchema,
  targetWords: z.number().int().min(1).max(10_000_000),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
})

export const updateWordGoalSchema = z.object({
  id: z.string().min(1),
  targetWords: z.number().int().min(1).max(10_000_000).optional(),
  endDate: z.coerce.date().nullable().optional(),
})

export type CreateWordGoalInput = z.infer<typeof createWordGoalSchema>
export type UpdateWordGoalInput = z.infer<typeof updateWordGoalSchema>
export type WordGoalTypeInput = z.infer<typeof wordGoalTypeSchema>
