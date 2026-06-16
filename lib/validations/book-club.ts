import { z } from 'zod'

export const createClubSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).optional(),
    rules: z.string().trim().max(2000).optional(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(20)).max(5).default([]),
    visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
    discoverable: z.boolean().optional().default(true),
    openJoin: z.boolean().optional().default(true),
    coverImageUrl: z.string().url().max(500).optional().nullable(),
  })
  .transform((d) => ({
    ...d,
    discoverable: d.visibility === 'PUBLIC' ? d.discoverable : false,
  }))

export const updateClubSchema = z.object({
  clubId: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  rules: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(20)).max(5).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
  discoverable: z.boolean().optional(),
  openJoin: z.boolean().optional(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
})

export const clubIdSchema = z.object({ clubId: z.string().min(1) })
export const targetUserSchema = z.object({
  clubId: z.string().min(1),
  targetUserId: z.string().min(1),
})
export const changeRoleSchema = z.object({
  clubId: z.string().min(1),
  targetUserId: z.string().min(1),
  newRole: z.enum(['MODERATOR', 'MEMBER']),
})

export const inviteByUsernameSchema = z.object({
  clubId: z.string().min(1),
  recipientUsername: z.string().trim().min(1).max(32),
})
export const inviteIdSchema = z.object({ inviteId: z.string().min(1) })
export const respondInviteSchema = z.object({
  inviteId: z.string().min(1),
  accept: z.boolean(),
})
export const claimTokenSchema = z.object({
  token: z.string().min(16).max(64),
})

export const requestIdSchema = z.object({ requestId: z.string().min(1) })
export const respondRequestSchema = z.object({
  requestId: z.string().min(1),
  accept: z.boolean(),
})

export const addClubBookSchema = z.object({
  clubId: z.string().min(1),
  bookId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  coverUrl: z.string().url().max(500).optional(),
  status: z.enum(['QUEUE', 'CURRENT']).default('QUEUE'),
})

export const updateClubBookSchema = z.object({
  rowId: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  author: z.string().trim().min(1).max(200).optional(),
  coverUrl: z.string().url().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
})

export const rowIdSchema = z.object({ rowId: z.string().min(1) })
export const reorderQueueSchema = z.object({
  clubId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
})

export const addScheduleItemSchema = z
  .object({
    clubId: z.string().min(1),
    bookId: z.string().min(1),
    chapterStart: z.number().int().min(1),
    chapterEnd: z.number().int().min(1),
    targetDate: z.coerce.date(),
    label: z.string().trim().max(80).optional(),
  })
  .refine((d) => d.chapterEnd >= d.chapterStart, {
    message: 'chapter_end must be >= chapter_start',
  })

export const updateScheduleItemSchema = z.object({
  itemId: z.string().min(1),
  chapterStart: z.number().int().min(1).optional(),
  chapterEnd: z.number().int().min(1).optional(),
  targetDate: z.coerce.date().optional(),
  label: z.string().trim().max(80).nullable().optional(),
  order: z.number().int().min(0).optional(),
})
export const itemIdSchema = z.object({ itemId: z.string().min(1) })

export const createDiscussionSchema = z.object({
  clubId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(10000),
})
export const updateDiscussionSchema = z.object({
  discussionId: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(10000).optional(),
})
export const discussionIdSchema = z.object({ discussionId: z.string().min(1) })
export const pinDiscussionSchema = z.object({
  discussionId: z.string().min(1),
  pin: z.boolean(),
})
export const replyToDiscussionSchema = z.object({
  discussionId: z.string().min(1),
  content: z.string().trim().min(1).max(5000),
})
export const replyIdSchema = z.object({ replyId: z.string().min(1) })

export const getClubsInputSchema = z.object({
  filter: z.enum(['mine', 'discover']),
  cursor: z.string().optional(),
  // Max raised from 50 → 200 so the Clubs Hub aggregator can over-fetch the
  // viewer's full club set (SINGLE_BUCKET_CAP = 126) in one call without
  // cursor pagination. Other callers (community feed, profile) use default
  // limits well below 200, so this is safely additive.
  limit: z.number().int().min(1).max(200).optional(),
})

export const getClubBooksInputSchema = z.object({
  clubId: z.string().min(1),
  status: z.enum(['CURRENT', 'PAST', 'QUEUE']).optional(),
})

export const listDiscussionsInputSchema = z.object({
  clubId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
})
