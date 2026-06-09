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
