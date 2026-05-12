import { z } from 'zod'

export const createHiveSchema = z.object({
  bookId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(['PRIVATE', 'PUBLIC', 'FRIENDS']).default('PRIVATE'),
})

export const updateHiveSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  visibility: z.enum(['PRIVATE', 'PUBLIC', 'FRIENDS']).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
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
