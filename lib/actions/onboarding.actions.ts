'use server'

import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { usernameSchema, onboardingSchema } from '@/lib/validations/onboarding'
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'

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

  // C5a T10: profile bio is LINK-ONLY per spec §3.4 — the @-username text is
  // rendered as a clickable <MentionLink> at read time via <RenderMentionsInText>,
  // but NO notifications fire. We deliberately skip resolveMentionedUsers +
  // recordMentionNotificationsTx here. The cap check still applies so a bio
  // can't be loaded with more than 5 @-mentions (matches surface budgets in §3.5).
  if (bio) {
    const bioUsernames = extractMentionUsernamesFromText(bio)
    if (bioUsernames.length > 5) {
      return { success: false, error: 'MENTION_CAP_EXCEEDED' }
    }
  }

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

  // Profile upsert + the users.image sync must land together — wrap both in one
  // transaction so a failure on the image update can't leave a profile written
  // without the matching avatar (or vice versa).
  try {
    await db.transaction(async (tx) => {
      await tx
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
        await tx.update(users).set({ image: avatarUrl }).where(eq(users.id, userId))
      }
    })
  } catch {
    return { success: false, error: 'Could not complete onboarding. Please try again.' }
  }

  return { success: true }
}
