/**
 * One-shot migration for C5b (Notification Prefs + Feed Ranking + Cleanup):
 *  1. CREATE TABLE notification_preferences (user-scoped opt-out array).
 *
 * Note: username_aliases table OMITTED per T0 audit — no username rename action
 * exists in the codebase (only insert/upsert in completeOnboardingAction).
 * Usernames are effectively immutable post-onboarding, so the alias-redirect
 * cleanup item (T11) closes as N/A.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-c5b.ts
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set')
  }
  const sql = neon(process.env.DATABASE_URL)

  console.log('Creating notification_preferences...')
  await sql`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      opted_out_types text[] NOT NULL DEFAULT '{}',
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `

  console.log('✓ Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
