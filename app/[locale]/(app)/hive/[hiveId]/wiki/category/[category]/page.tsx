import { notFound } from 'next/navigation'
import { getHiveWikiEntriesByCategory } from '@/lib/actions/hive-content.actions'
import { CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import { HiveWikiCategoryView } from '../../_components/hive-wiki-category-view'

export default async function HiveWikiCategoryPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string; category: string }>
}) {
  const { hiveId, locale, category } = await params
  // Validate category against the template map; unknown categories 404.
  if (!(category in CATEGORY_TEMPLATE_MAP)) notFound()
  const typedCategory = category as WikiCategory

  const result = await getHiveWikiEntriesByCategory(hiveId, typedCategory)
  if (!result.success) notFound()

  return (
    <HiveWikiCategoryView
      hiveId={hiveId}
      locale={locale}
      bookId={result.data.bookId}
      category={typedCategory}
      entries={result.data.entries}
      viewerRole={result.data.viewerRole}
    />
  )
}
