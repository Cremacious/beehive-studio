import { z } from 'zod'

export const discussionTopicSchema = z.enum([
  'GENERAL',
  'WORLDBUILDING',
  'FEEDBACK',
  'OFF_TOPIC',
])
export type DiscussionTopic = z.infer<typeof discussionTopicSchema>

export const createDiscussionPostSchema = z.object({
  hiveId: z.string().min(1),
  topic: discussionTopicSchema,
  body: z.string().min(1, 'body is required'),
})
export type CreateDiscussionPostInput = z.infer<typeof createDiscussionPostSchema>

export const replyToDiscussionPostSchema = z.object({
  parentId: z.string().min(1),
  body: z.string().min(1, 'body is required'),
})
export type ReplyToDiscussionPostInput = z.infer<typeof replyToDiscussionPostSchema>

export const editDiscussionPostSchema = z.object({
  postId: z.string().min(1),
  body: z.string().min(1, 'body is required'),
})
export type EditDiscussionPostInput = z.infer<typeof editDiscussionPostSchema>

export const listDiscussionPostsSchema = z.object({
  hiveId: z.string().min(1),
  topics: z.array(discussionTopicSchema).optional(),
})
export type ListDiscussionPostsInput = z.infer<typeof listDiscussionPostsSchema>
