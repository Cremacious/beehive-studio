import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { sendVerificationEmail, sendPasswordResetEmail } from './email'

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET environment variable is required')
}

const appleConfigured =
  !!process.env.APPLE_CLIENT_ID &&
  !!process.env.APPLE_TEAM_ID &&
  !!process.env.APPLE_KEY_ID &&
  !!process.env.APPLE_PRIVATE_KEY

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

// Trust both the apex and www variants of the configured origin so an auth
// request isn't rejected if a user lands on the non-canonical host (e.g. before
// Vercel's apex/www redirect kicks in, or a stale bookmark). Vercel should still
// redirect one host to the other so OAuth state cookies stay on a single domain.
function originVariants(url: string): string[] {
  try {
    const u = new URL(url)
    const variants = new Set([`${u.protocol}//${u.host}`])
    if (u.host.startsWith('www.')) {
      variants.add(`${u.protocol}//${u.host.slice(4)}`)
    } else {
      variants.add(`${u.protocol}//www.${u.host}`)
    }
    return [...variants]
  } catch {
    return [url]
  }
}

const trustedOrigins = [
  ...new Set([...originVariants(baseURL), 'http://localhost:3000']),
]

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      await sendPasswordResetEmail(user.email, url)
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      await sendVerificationEmail(user.email, url)
    },
    callbackURL: '/sign-in',
  },
  socialProviders: {
    ...(process.env.GOOGLE_AUTH_CLIENT_ID && {
      google: {
        clientId: process.env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET!,
      },
    }),
    ...(appleConfigured && {
      apple: {
        clientId: process.env.APPLE_CLIENT_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
        keyId: process.env.APPLE_KEY_ID!,
        privateKey: process.env.APPLE_PRIVATE_KEY!,
      },
    }),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'apple'],
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
