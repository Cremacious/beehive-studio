import { PageHead } from '@/components/community/page-head'
import { DeleteAccountSection } from './_components/delete-account-section'
import { AvatarUploader } from '@/components/avatar-uploader'
import { getOptionalUserId } from '@/lib/require-auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const metadata = { title: 'Account settings · Beehive Studio' }

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const userId = await getOptionalUserId()

  const profile = userId
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
        columns: { avatarUrl: true, displayName: true, username: true },
      })
    : null

  return (
    <main className="cm-wrap w-3xl">
      <PageHead
        title="Account"
        subtitle="Manage your account settings and danger zone actions."
      />

      {userId && (
        <section
          className="rounded-[20px] p-6 mb-6"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <h2
            className="mainFont font-bold text-[15px] mb-4"
            style={{ color: 'var(--brand)' }}
          >
            Profile picture
          </h2>
          <AvatarUploader
            userId={userId}
            displayName={profile?.displayName ?? null}
            username={profile?.username ?? ''}
            currentAvatarUrl={profile?.avatarUrl ?? null}
          />
        </section>
      )}

      <DeleteAccountSection locale={locale} />
    </main>
  )
}
