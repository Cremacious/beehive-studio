import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AppNav } from './_components/app-nav'
import { AppFooter } from '@/components/app-footer'

// Every authenticated app surface (studio, community, hive, settings, welcome,
// redeem, support) is private and must never be indexed or leaked (issue #52).
// Child pages may still set their own `title`; they inherit this robots default.
export const metadata = { robots: { index: false, follow: false } }

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) redirect(`/${locale}/sign-in`)

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, session.user.id),
    columns: { onboardingComplete: true, username: true, avatarUrl: true },
  })

  if (!profile?.onboardingComplete) redirect(`/${locale}/onboarding`)

  // Read the avatar from userProfiles (the source of truth) rather than
  // session.user.image, which better-auth caches in a signed cookie for 5
  // minutes — so a freshly-uploaded avatar would otherwise lag in the navbar.
  const navUser = {
    ...session.user,
    image: profile.avatarUrl ?? session.user.image ?? null,
  }

  // Bottom padding on mobile clears the fixed bottom tab bar (issue #50);
  // zero at md+ so desktop is unchanged.
  return (
    <div className="min-h-screen bg-[#262728] flex flex-col max-md:pb-[calc(56px+env(safe-area-inset-bottom))]">
      <AppNav locale={locale} user={navUser} username={profile.username ?? null} />
      <main className="flex-1 flex flex-col pt-1.5">{children}</main>
      <AppFooter />
    </div>
  )
}
