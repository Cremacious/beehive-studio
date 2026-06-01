import { z } from 'zod'

export const saveSubmissionDraftSchema = z.object({
  submissionId: z.string().min(1).optional(),
  hiveId: z.string().min(1),
  title: z.string().max(500),
  content: z.any(),
  targetChapterOrder: z.number().int().nullable(),
})
export type SaveSubmissionDraftInput = z.infer<typeof saveSubmissionDraftSchema>

export const submitSubmissionSchema = z.object({
  id: z.string().min(1),
})
export type SubmitSubmissionInput = z.infer<typeof submitSubmissionSchema>

export const approveSubmissionSchema = z.object({
  id: z.string().min(1),
  reviewNote: z.string().optional(),
})
export type ApproveSubmissionInput = z.infer<typeof approveSubmissionSchema>

export const rejectSubmissionSchema = z.object({
  id: z.string().min(1),
  reviewNote: z.string().min(1, 'reviewNote is required'),
})
export type RejectSubmissionInput = z.infer<typeof rejectSubmissionSchema>
