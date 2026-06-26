import { notFound } from 'next/navigation'
import { getHiveOutlineView } from '@/lib/actions/hive-content.actions'
import { canEditOutline } from '@/lib/hive/permissions'
import { HivePageShell } from '../_components/hive-page-shell'
import { OutlineIndex } from './_components/outline-index'
import { NewOutlineCTA } from './_components/new-outline-cta'

export default async function HiveOutlineIndexPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const r = await getHiveOutlineView(hiveId)
  if (!r.success) notFound()

  const count = r.data.outlines.length
  const subtitle = `${count} ${count === 1 ? 'outline' : 'outlines'} in this hive`
  const showCta = canEditOutline(r.data.viewerRole)

  return (
    <>
      {/* Mobile (issue #50, variant A) — outside the shell so it gets full width. */}
      <div className="md:hidden pt-3">
        <OutlineIndex
          outlines={r.data.outlines}
          hiveId={hiveId}
          locale={locale}
          cta={showCta ? <NewOutlineCTA hiveId={hiveId} locale={locale} fullWidth /> : null}
          mobile
        />
      </div>

      {/* Desktop — unchanged. */}
      <div className="max-md:hidden">
        <HivePageShell
          width="wide"
          title="Outlines"
          subtitle={subtitle}
          headerSlot={showCta ? <NewOutlineCTA hiveId={hiveId} locale={locale} /> : null}
        >
          <OutlineIndex
            outlines={r.data.outlines}
            hiveId={hiveId}
            locale={locale}
          />
        </HivePageShell>
      </div>
    </>
  )
}
