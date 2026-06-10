/**
 * One-shot migration for the Admin Panel:
 *   1. CREATE TYPE promo_code_kind
 *   2. CREATE TABLE promo_codes
 *   3. CREATE TABLE promo_redemptions
 *   4. CREATE TABLE admin_actions
 *   5. ALTER user_billing ADD COLUMN comp_entitlement_until
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-admin.ts
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set')
  }
  const sql = neon(process.env.DATABASE_URL)

  console.log('1. Creating promo_code_kind enum...')
  await sql`
    DO $$ BEGIN
      CREATE TYPE promo_code_kind AS ENUM ('DAYS_30', 'DAYS_90', 'DAYS_365', 'LIFETIME');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `

  console.log('2. Creating promo_codes...')
  await sql`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id text PRIMARY KEY,
      code text NOT NULL UNIQUE,
      kind promo_code_kind NOT NULL,
      note text,
      max_uses integer,
      uses_count integer NOT NULL DEFAULT 0,
      is_active text NOT NULL DEFAULT 'true',
      created_by text,
      created_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes (code)`

  console.log('3. Creating promo_redemptions...')
  await sql`
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id text PRIMARY KEY,
      promo_code_id text NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redeemed_at timestamp NOT NULL DEFAULT now(),
      granted_until timestamp
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx ON promo_redemptions (user_id)`
  await sql`CREATE INDEX IF NOT EXISTS promo_redemptions_code_idx ON promo_redemptions (promo_code_id)`

  console.log('4. Creating admin_actions...')
  await sql`
    CREATE TABLE IF NOT EXISTS admin_actions (
      id text PRIMARY KEY,
      admin_email text NOT NULL,
      action text NOT NULL,
      target_type text,
      target_id text,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS admin_actions_created_idx ON admin_actions (created_at)`
  await sql`CREATE INDEX IF NOT EXISTS admin_actions_target_idx ON admin_actions (target_type, target_id)`

  console.log('5. Adding user_billing.comp_entitlement_until...')
  await sql`
    ALTER TABLE user_billing
    ADD COLUMN IF NOT EXISTS comp_entitlement_until timestamp
  `

  const promo = await sql`SELECT count(*)::int AS n FROM promo_codes`
  const red = await sql`SELECT count(*)::int AS n FROM promo_redemptions`
  const aa = await sql`SELECT count(*)::int AS n FROM admin_actions`
  console.log(`✓ promo_codes=${promo[0].n}, promo_redemptions=${red[0].n}, admin_actions=${aa[0].n}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
