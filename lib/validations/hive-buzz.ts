import { z } from 'zod'

export const buzzPostTypeSchema = z.enum(['TEXT', 'LINK'])
export type BuzzPostType = z.infer<typeof buzzPostTypeSchema>

export const linkUrlSchema = z.string().refine(
  (s) => {
    try {
      return new URL(s).protocol === 'https:'
    } catch {
      return false
    }
  },
  { message: 'Must be a valid https URL' },
)

export const createBuzzPostSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TEXT'),
    hiveId: z.string().min(1),
    body: z.string().min(1).max(1000),
  }),
  z.object({
    type: z.literal('LINK'),
    hiveId: z.string().min(1),
    body: z.string().max(280),
    linkUrl: linkUrlSchema,
  }),
])
export type CreateBuzzPostInput = z.infer<typeof createBuzzPostSchema>

export const updateBuzzPostSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(0).max(1000),
  linkUrl: linkUrlSchema.optional().nullable(),
})
export type UpdateBuzzPostInput = z.infer<typeof updateBuzzPostSchema>

export const listBuzzPostsSchema = z.object({
  hiveId: z.string().min(1),
  cursor: z
    .object({
      createdAt: z.coerce.date(),
      id: z.string().min(1),
    })
    .optional(),
  limit: z.number().int().min(1).max(50).optional(),
})
export type ListBuzzPostsInput = z.infer<typeof listBuzzPostsSchema>

export const toggleBuzzLikeSchema = z.object({
  buzzId: z.string().min(1),
})
export type ToggleBuzzLikeInput = z.infer<typeof toggleBuzzLikeSchema>
