import { z } from 'zod'

export const createSuggestionSchema = z
  .object({
    hiveId: z.string().min(1),
    chapterId: z.string().min(1),
    selectionStart: z.number().int().min(0),
    selectionEnd: z.number().int().min(0),
    originalExcerpt: z.string().min(1),
    suggestedText: z.string().min(1),
    body: z.string().optional(),
  })
  .refine((v) => v.selectionEnd > v.selectionStart, {
    message: 'selectionEnd must be greater than selectionStart',
    path: ['selectionEnd'],
  })

export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>

export const replyToSuggestionSchema = z.object({
  parentId: z.string().min(1),
  body: z.string().min(1),
})

export type ReplyToSuggestionInput = z.infer<typeof replyToSuggestionSchema>

export const rejectSuggestionSchema = z.object({
  id: z.string().min(1),
  note: z.string().optional(),
})

export type RejectSuggestionInput = z.infer<typeof rejectSuggestionSchema>
