import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HivePageShell } from '../_components/hive-page-shell'
import { HiveSettingsForm } from '../_components/hive-settings-form'

export default async function HiveSettingsPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  const { hive, isOwner } = result.data

  if (!isOwner) {
    return (
      <HivePageShell
        width="standard"
        title="Settings"
        subtitle="Manage your hive."
        back={{ href: `/${locale}/hive/${hiveId}`, label: 'dashboard' }}
      >
        <div className="px-6 py-5 text-sm" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Only the hive owner can edit settings.
        </div>
      </HivePageShell>
    )
  }

  return (
    <HivePageShell
      width="standard"
      title="Settings"
      subtitle="Manage your hive."
      back={{ href: `/${locale}/hive/${hiveId}`, label: 'dashboard' }}
    >
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
    </HivePageShell>
  )
}
