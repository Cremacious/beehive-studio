import { z } from 'zod'

export const createListSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
    discoverable: z.boolean().optional().default(true),
    tags: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .min(1)
          .max(20)
          // Issue #22: tags appear in URL filters (?tags=a,b) and tag-route
          // slugs, so we reject literal hyphens (slug separator) + commas
          // (multi-select separator) + slashes (path separator) + plus signs
          // (URL space encoding).
          .regex(/^[^,\-/+]+$/, {
            message: 'Tags cannot contain , - / or +',
          }),
      )
      .max(5)
      .default([]),
  })
  .transform((d) => ({
    ...d,
    discoverable: d.visibility === 'PUBLIC' ? d.discoverable : false,
  }))

export const updateListSchema = z.object({
  listId: z.string().min(1),
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
  discoverable: z.boolean().optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(1)
        .max(20)
        .regex(/^[^,\-/+]+$/, {
          message: 'Tags cannot contain , - / or +',
        }),
    )
    .max(5)
    .optional(),
})

export const addBookSchema = z.object({
  listId: z.string().min(1),
  bookId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  coverUrl: z.string().url().max(500).optional(),
  isRead: z.boolean().optional().default(false),
  rating: z.number().int().min(1).max(5).optional(),
  commentary: z.string().trim().max(500).optional(),
})

export const updateListBookSchema = z.object({
  bookRowId: z.string().min(1),
  isRead: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  commentary: z.string().trim().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
})

export const listIdSchema = z.object({ listId: z.string().min(1) })

export const bookRowIdSchema = z.object({ bookRowId: z.string().min(1) })

export const reorderBooksSchema = z.object({
  listId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
})

export const searchBooksSchema = z.object({
  query: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(50).optional(),
})
