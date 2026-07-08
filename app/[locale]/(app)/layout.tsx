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
    columns: { onboardingComplete: true, username: true, displayName: true, avatarUrl: true },
  })

  if (!profile?.onboardingComplete) redirect(`/${locale}/onboarding`)

  // Identity comes from userProfiles only (issue #55) — NEVER the Google/OAuth
  // `session.user.name` / `session.user.image`. The name falls back to
  // @username; the avatar falls back to the initial letter (no OAuth photo).
  // userProfiles is also the source of truth better-auth's 5-minute cookie
  // cache would otherwise lag on a fresh avatar upload.
  const navUser = {
    ...session.user,
    name: profile.displayName ?? (profile.username ? `@${profile.username}` : null),
    image: profile.avatarUrl ?? null,
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
