import { z } from 'zod'

export const TITLE_MAX = 60
export const PROMPT_MAX = 500
export const DESCRIPTION_MAX = 2000
export const RULES_MAX = 2000

export const createSparkSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(TITLE_MAX),
  prompt: z
    .string()
    .trim()
    .min(10, 'Prompt must be at least 10 characters')
    .max(PROMPT_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),
  rules: z.string().trim().max(RULES_MAX).optional(),
  wordLimit: z.number().int().positive().nullable().optional(),
  genre: z.string().nullable().optional(),
  deadline: z.coerce.date(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
  discoverable: z.boolean().default(true),
})

export type CreateSparkInput = z.infer<typeof createSparkSchema>

export const updateSparkSchema = createSparkSchema.partial().extend({
  id: z.string().min(1),
})
export type UpdateSparkInput = z.infer<typeof updateSparkSchema>
