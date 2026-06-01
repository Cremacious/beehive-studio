import { z } from 'zod'

export const annotationLayerSchema = z.enum([
  'GRAMMAR',
  'PLOT',
  'TONE',
  'CONTINUITY',
  'GENERAL',
])

export const createAnnotationSchema = z
  .object({
    hiveId: z.string().min(1),
    chapterId: z.string().min(1),
    layer: annotationLayerSchema,
    body: z.string().min(1),
    selectionStart: z.number().int().min(0),
    selectionEnd: z.number().int().min(0),
    selectedText: z.string().optional(),
  })
  .refine((v) => v.selectionEnd > v.selectionStart, {
    message: 'selectionEnd must be greater than selectionStart',
    path: ['selectionEnd'],
  })

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>

export const replyToAnnotationSchema = z.object({
  parentId: z.string().min(1),
  body: z.string().min(1),
})

export type ReplyToAnnotationInput = z.infer<typeof replyToAnnotationSchema>
