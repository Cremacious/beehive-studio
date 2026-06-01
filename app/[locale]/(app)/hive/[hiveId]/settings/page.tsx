import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveSettingsForm } from '../_components/hive-settings-form'

export default async function HiveSettingsPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  const { hive, isOwner } = result.data

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            border: 'var(--br-card)',
          }}
          className="p-6"
        >
          <h1
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-bold text-2xl mb-6"
          >
            Settings
          </h1>
          <p
            style={{
              background: 'var(--canvas-dark-100)',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-inset)',
              color: 'var(--canvas-dark-ink-muted)',
            }}
            className="px-4 py-3 text-sm"
          >
            Only the owner can edit hive settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <HiveSettingsForm
      hiveId={hive.id}
      locale={locale}
      initial={{
        name: hive.name,
        description: hive.description ?? '',
        visibility: hive.visibility,
        discoverable: hive.discoverable,
      }}
    />
  )
}
