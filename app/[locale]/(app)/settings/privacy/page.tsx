import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getPrivacySettingsAction } from '@/lib/actions/settings.actions'
import { PrivacyForm } from './_components/privacy-form'

export const metadata = { title: 'Privacy · Settings' }

export default async function PrivacySettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const userId = await requireAuth().catch(() => null)
  if (!userId) redirect(`/${locale}/sign-in`)

  const result = await getPrivacySettingsAction()
  const settings = result.data ?? {
    allowFollow: true,
    showLikedBooks: true,
    showActivityFeed: true,
    appearInSuggested: true,
    findableByEmail: false,
  }

  return (
    <>
      <header className="mb-6">
        <h1
          className="text-[22px] font-bold"
          style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
        >
          Privacy
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Control what others can see and how they can interact with you. Toggles save instantly.
        </p>
      </header>

      <section
        className="rounded-[20px] p-6"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
        }}
      >
        <h2
          className="font-bold text-[15px] mb-5"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
        >
          Visibility settings
        </h2>
        <PrivacyForm initialValues={settings} />
      </section>
    </>
  )
}
