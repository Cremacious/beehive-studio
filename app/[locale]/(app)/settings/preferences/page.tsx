import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getPreferencesAction } from '@/lib/actions/settings.actions'
import { PreferencesForm } from './_components/preferences-form'
import { ResetTipsSection } from '@/components/tips/reset-tips-section'

export const metadata = { title: 'Preferences · Settings · Beehive Books' }

export default async function PreferencesSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const userId = await requireAuth().catch(() => null)
  if (!userId) redirect(`/${locale}/sign-in`)

  const result = await getPreferencesAction()
  const prefs = result.data ?? {
    defaultBookVisibility: 'PRIVATE',
    defaultGenre: null,
    defaultSparkWordLimit: null,
    editorTheme: 'light',
    genreInterests: [],
  }

  return (
    <>
      <header className="mb-6">
        <h1
          className="text-[22px] font-bold"
          style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
        >
          Preferences
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Set writing defaults and tailor your discovery experience.
        </p>
      </header>

      <PreferencesForm
        defaultBookVisibility={prefs.defaultBookVisibility}
        defaultGenre={prefs.defaultGenre}
        defaultSparkWordLimit={prefs.defaultSparkWordLimit}
        genreInterests={prefs.genreInterests}
      />

      <div className="mt-8">
        <ResetTipsSection />
      </div>
    </>
  )
}
