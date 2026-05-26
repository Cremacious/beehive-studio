import { z } from 'zod'

export const createBookSchema = z.object({
  // Step 1
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  subtitle: z.string().max(200).optional(),
  synopsis: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional().nullable(),
  // Step 2
  genre: z.string().max(50).optional(),
  subgenre: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  targetAudience: z.string().max(50).optional(),
  contentWarnings: z.array(z.string().max(100)).max(20).optional(),
  compTitles: z.array(z.string().max(200)).max(5).optional(),
  language: z.string().max(50).optional(),
  // Step 3
  templateId: z.string().optional(),
  seriesName: z.string().max(200).optional(),
  seriesNumber: z.number().int().min(1).max(9999).optional(),
  publisherName: z.string().max(200).optional(),
  trimSize: z.string().max(20).optional(),
  edition: z.string().max(100).optional(),
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
  content: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const updateBinderItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.record(z.string(), z.unknown()).optional().nullable(),
  parentId: z.string().nullable().optional(),
})

export const reorderBinderItemsSchema = z.array(z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  parentId: z.string().nullable(),
}))

export const chapterStatusSchema = z.enum(['IDEA', 'OUTLINE', 'FIRST_DRAFT', 'REVISED', 'FINAL'])

export const updateChapterNotesSchema = z.object({
  notes: z.string().max(10000).nullable(),
})

export const updateChapterWordGoalSchema = z.object({
  wordGoal: z.number().int().min(0).max(1_000_000),
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
