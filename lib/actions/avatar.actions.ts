'use server'

import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { deleteCloudinaryImage, getCloudinaryPublicId } from '@/lib/cloudinary'

export async function updateAvatarAction(avatarUrl: string | null): Promise<{
  success: boolean
  error?: string
}> {
  const userId = await requireAuth()

  // Before persisting the new URL, delete the old Cloudinary asset if it exists
  // and has a deterministic avatars/{userId} public_id. Best-effort — failure
  // must not block the update.
  if (avatarUrl !== null) {
    try {
      const existing = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
        columns: { avatarUrl: true },
      })
      if (existing?.avatarUrl) {
        const oldId = getCloudinaryPublicId(existing.avatarUrl)
        if (oldId) await deleteCloudinaryImage(oldId)
      }
    } catch {
      // Non-fatal
    }
  }

  await db
    .insert(userProfiles)
    .values({ userId, avatarUrl })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { avatarUrl, updatedAt: new Date() },
    })

  // Keep better-auth's users.image in sync
  await db
    .update(users)
    .set({ image: avatarUrl })
    .where(eq(users.id, userId))

  return { success: true }
}

export async function deleteAvatarAction(): Promise<{
  success: boolean
  error?: string
}> {
  const userId = await requireAuth()

  try {
    const existing = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
      columns: { avatarUrl: true },
    })
    if (existing?.avatarUrl) {
      const publicId = getCloudinaryPublicId(existing.avatarUrl)
      if (publicId) await deleteCloudinaryImage(publicId)
    }
  } catch {
    // Non-fatal: proceed even if Cloudinary deletion fails
  }

  await db
    .insert(userProfiles)
    .values({ userId, avatarUrl: null })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { avatarUrl: null, updatedAt: new Date() },
    })

  await db
    .update(users)
    .set({ image: null })
    .where(eq(users.id, userId))

  return { success: true }
}
