import { getPublicHivesAction } from '@/lib/actions/hive.actions'

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const result = await getPublicHivesAction().catch(() => null)
  const hives = result?.success ? result.data : []

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-foreground mb-6">Community Hives</h1>
      {hives.length === 0 ? (
        <p className="text-sm text-muted-foreground">No public Hives yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hives.map(hive => (
            <div key={hive.id} className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{hive.name}</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground shrink-0">Public</span>
              </div>
              {hive.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{hive.description}</p>}
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{hive.memberCount} members</span>
                <a
                  href={`/${locale}/hive/${hive.id}`}
                  className="text-xs px-3 py-1 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors"
                >
                  View Hive
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
