'use server'

import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin/require-admin'
import { logAdminAction } from '@/lib/admin/log-action'

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

export async function wipeDatabaseAction(
  confirmation: string,
): Promise<{ ok: boolean; error?: string; truncated?: string[] }> {
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

  return { ok: true, truncated: APP_TABLES }
}
