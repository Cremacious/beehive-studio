'use server'

import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { usernameSchema, onboardingSchema } from '@/lib/validations/onboarding'

export async function checkUsernameAvailableAction(username: string): Promise<{
  available: boolean
  error?: string
}> {
  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) {
    return { available: false, error: parsed.error.issues[0].message }
  }

  const userId = await requireAuth().catch(() => null)

  const existing = await db.query.userProfiles.findFirst({
    where: userId
      ? and(
          eq(userProfiles.username, username.toLowerCase()),
          ne(userProfiles.userId, userId),
        )
      : eq(userProfiles.username, username.toLowerCase()),
    columns: { userId: true },
  })

  return { available: !existing }
}

export async function completeOnboardingAction(data: {
  username: string
  bio?: string
  avatarUrl?: string
}): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth()

  const parsed = onboardingSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { username, bio, avatarUrl } = parsed.data

  const existing = await db.query.userProfiles.findFirst({
    where: and(
      eq(userProfiles.username, username.toLowerCase()),
      ne(userProfiles.userId, userId),
    ),
    columns: { userId: true },
  })

  if (existing) {
    return { success: false, error: 'Username is already taken' }
  }

  await db
    .insert(userProfiles)
    .values({
      userId,
      username: username.toLowerCase(),
      bio: bio ?? null,
      avatarUrl: avatarUrl ?? null,
      onboardingComplete: true,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        username: username.toLowerCase(),
        bio: bio ?? null,
        avatarUrl: avatarUrl ?? null,
        onboardingComplete: true,
        updatedAt: new Date(),
      },
    })

  if (avatarUrl) {
    await db.update(users).set({ image: avatarUrl }).where(eq(users.id, userId))
  }

  return { success: true }
}
