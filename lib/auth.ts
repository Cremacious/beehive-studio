import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { sendVerificationEmail, sendPasswordResetEmail } from './email'

const appleConfigured =
  !!process.env.APPLE_CLIENT_ID &&
  !!process.env.APPLE_TEAM_ID &&
  !!process.env.APPLE_KEY_ID &&
  !!process.env.APPLE_PRIVATE_KEY

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
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
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
    google: {
      clientId: process.env.GOOGLE_AUTH_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET ?? '',
      enabled: !!process.env.GOOGLE_AUTH_CLIENT_ID,
    },
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
