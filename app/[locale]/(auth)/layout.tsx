import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Auth surfaces (sign in / up, password reset, onboarding) carry no indexable
// content and should stay out of search results (issue #52).
export const metadata = { robots: { index: false, follow: false } }

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user?.id) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, session.user.id),
      columns: { onboardingComplete: true },
    })
    if (profile?.onboardingComplete) redirect(`/${locale}/studio`)
  }

  return <>{children}</>
}
