/**
 * Neon DB connectivity canary. Run when middleware / Better Auth queries hang
 * or return WebSocket ErrorEvents — confirms the DB is reachable + the env is
 * configured. Run via `npx dotenv -e .env.local -- tsx scripts/ping-sessions.ts`.
 * Times the SELECT; <2s = healthy, multi-second timeout = connectivity issue.
 *
 * Kept in tree as the canonical "is Neon up?" sanity check — don't delete.
 */
import { db } from '@/db'
import { sessions } from '@/db/schema'

console.time('sessions-query')
db.select()
  .from(sessions)
  .limit(1)
  .then((rows) => {
    console.timeEnd('sessions-query')
    console.log('OK — rows returned:', rows.length)
    process.exit(0)
  })
  .catch((err) => {
    console.timeEnd('sessions-query')
    console.error('FAIL:', err)
    process.exit(1)
  })
