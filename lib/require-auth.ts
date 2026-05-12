import { headers } from 'next/headers'
import { auth } from './auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function requireAuth(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error('Unauthorized')

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { banned: true },
  })
  if (user?.banned) throw new Error('Your account has been suspended.')

  return session.user.id
}

export async function getOptionalUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id ?? null
  } catch {
    return null
  }
}
