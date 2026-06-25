'use server'

import { db } from '@/db'
import { userProfiles, userPrivacySettings, userPreferences } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { z } from 'zod'
import { usernameSchema } from '@/lib/validations/onboarding'
import { isValidGenre } from '@/lib/discover/genres'

// ─── Profile ───────────────────────────────────────────────────────────────

const profileSchema = z.object({
  displayName: z.string().max(50, 'Display name must be 50 characters or less').optional(),
  username: usernameSchema.optional(),
  bio: z.string().max(200, 'Bio must be 200 characters or less').optional(),
  website: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v?.trim() || null)),
  location: z
    .string()
    .max(100, 'Location must be 100 characters or less')
    .optional()
    .transform((v) => (v?.trim() || null)),
})

export async function updateProfileAction(data: {
  displayName?: string
  username?: string
  bio?: string
  website?: string
  location?: string
}): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth()

  const parsed = profileSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { displayName, username, bio, website, location } = parsed.data

  // If username is changing, check uniqueness
  if (username !== undefined) {
    const existing = await db.query.userProfiles.findFirst({
      where: and(
        eq(userProfiles.username, username.toLowerCase()),
        ne(userProfiles.userId, userId),
      ),
      columns: { userId: true },
    })
    if (existing) {
      return { success: false, error: 'That username is already taken.' }
    }
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }
  if (displayName !== undefined) updates.displayName = displayName.trim() || null
  if (username !== undefined) updates.username = username.toLowerCase()
  if (bio !== undefined) updates.bio = bio.trim() || null
  if (website !== undefined) updates.website = website
  if (location !== undefined) updates.location = location

  try {
    await db.update(userProfiles).set(updates).where(eq(userProfiles.userId, userId))
  } catch {
    return { success: false, error: 'Could not save your profile. Please try again.' }
  }

  return { success: true }
}

// ─── Privacy Settings ───────────────────────────────────────────────────────

export async function updatePrivacySettingAction(
  key: 'allowFollow' | 'showLikedBooks' | 'showActivityFeed' | 'appearInSuggested' | 'findableByEmail',
  value: boolean,
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth()

  try {
    await db
      .insert(userPrivacySettings)
      .values({
        userId,
        [key]: value,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPrivacySettings.userId,
        set: {
          [key]: value,
          updatedAt: new Date(),
        },
      })
  } catch {
    return { success: false, error: 'Could not save your privacy setting. Please try again.' }
  }

  return { success: true }
}

export async function getPrivacySettingsAction(): Promise<{
  success: boolean
  data?: {
    allowFollow: boolean
    showLikedBooks: boolean
    showActivityFeed: boolean
    appearInSuggested: boolean
    findableByEmail: boolean
  }
  error?: string
}> {
  const userId = await requireAuth()

  const row = await db.query.userPrivacySettings.findFirst({
    where: eq(userPrivacySettings.userId, userId),
  })

  return {
    success: true,
    data: {
      allowFollow: row?.allowFollow ?? true,
      showLikedBooks: row?.showLikedBooks ?? true,
      showActivityFeed: row?.showActivityFeed ?? true,
      appearInSuggested: row?.appearInSuggested ?? true,
      findableByEmail: row?.findableByEmail ?? false,
    },
  }
}

// ─── Preferences ────────────────────────────────────────────────────────────

const preferencesSchema = z.object({
  defaultBookVisibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
  defaultGenre: z.string().nullable().optional(),
  defaultSparkWordLimit: z.string().nullable().optional(),
  editorTheme: z.enum(['light', 'dark']).optional(),
  genreInterests: z.array(z.string()).optional(),
})

export async function updatePreferencesAction(data: {
  defaultBookVisibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  defaultGenre?: string | null
  defaultSparkWordLimit?: string | null
  editorTheme?: 'light' | 'dark'
  genreInterests?: string[]
}): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth()

  const parsed = preferencesSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const d = parsed.data

  // Validate genre interests
  if (d.genreInterests) {
    const invalid = d.genreInterests.filter((g) => !isValidGenre(g))
    if (invalid.length > 0) {
      return { success: false, error: 'Invalid genre selection.' }
    }
  }

  try {
    await db
      .insert(userPreferences)
      .values({
        userId,
        defaultBookVisibility: d.defaultBookVisibility ?? 'PRIVATE',
        defaultGenre: d.defaultGenre ?? null,
        defaultSparkWordLimit: d.defaultSparkWordLimit ?? null,
        editorTheme: d.editorTheme ?? 'light',
        genreInterests: d.genreInterests ?? [],
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          ...(d.defaultBookVisibility !== undefined && { defaultBookVisibility: d.defaultBookVisibility }),
          ...(d.defaultGenre !== undefined && { defaultGenre: d.defaultGenre }),
          ...(d.defaultSparkWordLimit !== undefined && { defaultSparkWordLimit: d.defaultSparkWordLimit }),
          ...(d.editorTheme !== undefined && { editorTheme: d.editorTheme }),
          ...(d.genreInterests !== undefined && { genreInterests: d.genreInterests }),
          updatedAt: new Date(),
        },
      })
  } catch {
    return { success: false, error: 'Could not save your preferences. Please try again.' }
  }

  return { success: true }
}

export async function getPreferencesAction(): Promise<{
  success: boolean
  data?: {
    defaultBookVisibility: string
    defaultGenre: string | null
    defaultSparkWordLimit: string | null
    editorTheme: string
    genreInterests: string[]
  }
  error?: string
}> {
  const userId = await requireAuth()

  const row = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  })

  return {
    success: true,
    data: {
      defaultBookVisibility: row?.defaultBookVisibility ?? 'PRIVATE',
      defaultGenre: row?.defaultGenre ?? null,
      defaultSparkWordLimit: row?.defaultSparkWordLimit ?? null,
      editorTheme: row?.editorTheme ?? 'light',
      genreInterests: (row?.genreInterests ?? []) as string[],
    },
  }
}
