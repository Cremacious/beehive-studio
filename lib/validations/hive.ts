import { z } from 'zod'

export const createHiveSchema = z
  .object({
    bookId: z.string().nullable().optional(),
    name: z.string().min(1).max(80),
    description: z.string().max(280).optional(),
    visibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']).default('PRIVATE'),
    discoverable: z.boolean().default(false),
  })
  .transform((v) => ({
    ...v,
    // Coerce: discoverable can only be true on PUBLIC hives.
    discoverable: v.visibility === 'PUBLIC' ? v.discoverable : false,
  }))

export const updateHiveSchema = z
  .object({
    hiveId: z.string(),
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(280).nullable().optional(),
    visibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']).optional(),
    discoverable: z.boolean().optional(),
  })
  .transform((v) => {
    // If visibility is being set to non-PUBLIC, force discoverable=false.
    if (v.visibility && v.visibility !== 'PUBLIC') v.discoverable = false
    return v
  })

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  assigneeId: z.string().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
})
