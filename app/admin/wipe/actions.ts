'use server'

import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin/require-admin'
import { logAdminAction } from '@/lib/admin/log-action'
import { deleteCloudinaryImage, getCloudinaryPublicId } from '@/lib/cloudinary'

// Tables NOT truncated: drizzle migrations, admin_actions (we want to keep
// the audit trail of the wipe action itself, and admins logging in won't
// be in any app table anyway since admin auth is env-based).
//
// Order does not matter because we use CASCADE.
const APP_TABLES = [
  // Auth + profile + billing
  'sessions',
  'accounts',
  'verifications',
  'user_billing',
  'user_profiles',
  'user_blocks',
  'user_mutes',
  'notification_preferences',
  'notifications',
  // Books + writing
  'chapter_snapshots',
  'chapter_reads',
  'chapter_comments',
  'reading_progress',
  'bookmarks',
  'book_likes',
  'book_comments',
  'book_publishing_metadata',
  'chapters',
  'binder_items',
  'books',
  // Social graph
  'follows',
  'friendships',
  'friend_invites',
  'social_activity',
  // Sparks
  'spark_entry_comments',
  'spark_votes',
  'spark_entries',
  'sparks',
  // Reading lists
  'reading_list_books',
  'reading_list_follows',
  'reading_lists',
  // Book clubs
  'book_club_discussion_likes',
  'book_club_discussion_reply_likes',
  'book_club_discussion_replies',
  'book_club_discussions',
  'book_club_schedule_items',
  'book_club_books',
  'book_club_join_requests',
  'book_club_invite_tokens',
  'book_club_invites',
  'book_club_members',
  'book_clubs',
  // Hives
  'hive_word_logs',
  'hive_word_goals',
  'hive_buzz_likes',
  'hive_buzz_posts',
  'hive_annotations',
  'hive_suggestions',
  'hive_submissions',
  'hive_discussion_posts',
  'hive_tasks',
  'hive_activity',
  'hive_invites',
  'hive_members',
  'hives',
  // Promo (delete redemptions but keep code definitions)
  'promo_redemptions',
  // Finally, users (cascades back into anything missed)
  'users',
]

// Cloudinary folders that hold user-uploaded assets. We only ever delete
// public IDs under these prefixes so a stray external/pasted URL in the DB
// can't make us touch something we didn't upload.
const CLOUDINARY_FOLDER_PREFIXES = [
  'avatars/',
  'covers/',
  'clubs/',
  'about-author/',
] as const

/**
 * Collects every Cloudinary-hosted image URL referenced by the app's data and
 * deletes the underlying assets, so a full DB wipe also clears the user content
 * stored in Cloudinary: avatars, book covers, club cover images, and the
 * about-author photos embedded in front/back-matter binder items.
 *
 * Best-effort: any failure here is swallowed and reported so it never blocks
 * the database wipe. Worst case is an orphaned Cloudinary asset.
 */
async function wipeCloudinaryAssets(): Promise<{ deleted: number; failed: number }> {
  const urls = new Set<string>()

  const collect = async (query: ReturnType<typeof sql.raw>, key: string) => {
    try {
      const result = await db.execute(query)
      for (const row of result.rows as Record<string, unknown>[]) {
        const value = row[key]
        if (typeof value === 'string' && value.length > 0) urls.add(value)
      }
    } catch {
      // Non-fatal: a missing/renamed column shouldn't abort the wipe.
    }
  }

  await collect(
    sql.raw(`SELECT avatar_url FROM "user_profiles" WHERE avatar_url IS NOT NULL`),
    'avatar_url',
  )
  await collect(
    sql.raw(`SELECT cover_url FROM "books" WHERE cover_url IS NOT NULL`),
    'cover_url',
  )
  await collect(
    sql.raw(`SELECT cover_image_url FROM "book_clubs" WHERE cover_image_url IS NOT NULL`),
    'cover_image_url',
  )
  // About-author photos live inside the binder item's JSON content.
  await collect(
    sql.raw(
      `SELECT content->'fields'->>'photoUrl' AS photo_url FROM "binder_items" ` +
        `WHERE content->>'subtype' = 'about_author' ` +
        `AND content->'fields'->>'photoUrl' IS NOT NULL`,
    ),
    'photo_url',
  )

  // Resolve to whitelisted Cloudinary public IDs (drops data: URLs, external
  // URLs, and anything outside our upload folders).
  const publicIds = new Set<string>()
  for (const url of urls) {
    const publicId = getCloudinaryPublicId(url)
    if (!publicId) continue
    if (!CLOUDINARY_FOLDER_PREFIXES.some((prefix) => publicId.startsWith(prefix))) continue
    publicIds.add(publicId)
  }

  let deleted = 0
  let failed = 0
  for (const publicId of publicIds) {
    try {
      await deleteCloudinaryImage(publicId)
      deleted++
    } catch {
      failed++
    }
  }

  return { deleted, failed }
}

export async function wipeDatabaseAction(
  confirmation: string,
): Promise<{
  ok: boolean
  error?: string
  truncated?: string[]
  imagesDeleted?: number
}> {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Disabled in production.' }
  }
  const admin = await requireAdmin()
  if (confirmation !== 'WIPE') {
    return { ok: false, error: 'Type WIPE exactly to confirm.' }
  }

  await logAdminAction({
    adminEmail: admin.email,
    action: 'db.wipe.start',
    metadata: { tables: APP_TABLES.length },
  })

  // Delete user-uploaded Cloudinary assets (avatars, book covers, club covers,
  // about-author photos) BEFORE truncating, while the URLs are still in the DB.
  // Best-effort: never let a Cloudinary failure block the database wipe.
  const cloudinary = await wipeCloudinaryAssets()
  await logAdminAction({
    adminEmail: admin.email,
    action: 'db.wipe.cloudinary',
    metadata: { deleted: cloudinary.deleted, failed: cloudinary.failed },
  })

  try {
    // Build a single TRUNCATE statement so it runs as one tx with CASCADE.
    const list = APP_TABLES.map((t) => `"${t}"`).join(', ')
    await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error.'
    await logAdminAction({
      adminEmail: admin.email,
      action: 'db.wipe.failed',
      metadata: { error: msg },
    })
    return { ok: false, error: `Truncate failed: ${msg}` }
  }

  await logAdminAction({
    adminEmail: admin.email,
    action: 'db.wipe.complete',
    metadata: { tables: APP_TABLES.length },
  })

  return { ok: true, truncated: APP_TABLES, imagesDeleted: cloudinary.deleted }
}
