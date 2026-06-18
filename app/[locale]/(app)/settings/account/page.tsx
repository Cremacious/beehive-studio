import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AvatarUploader } from '@/components/avatar-uploader'
import { ProfileForm } from './_components/profile-form'
import { PasswordSection } from './_components/password-section'
import { DeleteAccountSection } from './_components/delete-account-section'

export const metadata = { title: 'Account · Settings · Beehive Studio' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-[20px] p-6 mb-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
      }}
    >
      <h2
        className="font-bold text-[15px] mb-5"
        style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const userId = await requireAuth().catch(() => null)
  if (!userId) redirect(`/${locale}/sign-in`)

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
    columns: {
      avatarUrl: true,
      displayName: true,
      username: true,
      bio: true,
      website: true,
      location: true,
    },
  })

  return (
    <>
      <header className="mb-6">
        <h1
          className="text-[22px] font-bold"
          style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
        >
          Account
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Manage your profile, password, and account actions.
        </p>
      </header>

      <Section title="Profile picture">
        <AvatarUploader
          userId={userId}
          displayName={profile?.displayName ?? null}
          username={profile?.username ?? ''}
          currentAvatarUrl={profile?.avatarUrl ?? null}
        />
      </Section>

      <Section title="Profile info">
        <ProfileForm
          displayName={profile?.displayName ?? null}
          username={profile?.username ?? null}
          bio={profile?.bio ?? null}
          website={(profile as { website?: string | null } | undefined)?.website ?? null}
          location={(profile as { location?: string | null } | undefined)?.location ?? null}
        />
      </Section>

      <Section title="Change password">
        <p className="text-[13px] mb-4" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          If you signed up with a social provider, you may not have a password set.
        </p>
        <PasswordSection />
      </Section>

      <DeleteAccountSection locale={locale} />
    </>
  )
}
