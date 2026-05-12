import { headers } from 'next/headers'
import { auth } from './auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export class AuthError extends Error {
  constructor(message: string, public readonly statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function requireAuth(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new AuthError('Unauthorized', 401)

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { banned: true },
  })
  if (user?.banned) throw new AuthError('Your account has been suspended.', 403)

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
