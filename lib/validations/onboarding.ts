import { z } from 'zod'

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be 20 characters or less')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')

export const bioSchema = z
  .string()
  .max(200, 'Bio must be 200 characters or less')
  .optional()

export const onboardingSchema = z.object({
  username: usernameSchema,
  bio: bioSchema,
  avatarUrl: z.string().url().optional(),
})
