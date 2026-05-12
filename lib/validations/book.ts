import { z } from 'zod'

export const createBookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  genre: z.string().max(50).optional(),
  templateId: z.string().optional(),
})

export const updateBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  genre: z.string().max(50).optional().nullable(),
  synopsis: z.string().max(2000).optional().nullable(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  coverUrl: z.string().url().optional().nullable(),
})

export const createBinderItemSchema = z.object({
  bookId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  type: z.enum([
    'part', 'chapter', 'front_matter', 'back_matter',
    'research_folder', 'research_note', 'character', 'outline',
  ]),
  title: z.string().min(1).max(200),
  order: z.number().int().min(0).default(0),
})

export const updateBinderItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.record(z.unknown()).optional().nullable(),
})

export const reorderBinderItemsSchema = z.array(z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  parentId: z.string().nullable(),
}))

export const updateChapterNotesSchema = z.object({
  notes: z.string().max(10000).nullable(),
})

export const updatePublishingMetadataSchema = z.object({
  isbn: z.string().max(20).optional().nullable(),
  subtitle: z.string().max(200).optional().nullable(),
  trimSize: z.string().max(20).optional(),
  authorBio: z.string().max(1000).optional().nullable(),
  dedication: z.string().max(500).optional().nullable(),
  publisherName: z.string().max(200).optional().nullable(),
  edition: z.string().max(100).optional(),
})
