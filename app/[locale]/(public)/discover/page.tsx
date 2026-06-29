import { PageHead } from '@/components/community/page-head'
import { DiscoverTabs } from './_components/tabs'
import { DiscoverShell } from './_components/discover-shell'
import { parseTab, type TabId } from '@/lib/discover/url-state'
import { HomeFilters } from './_components/home-filters'
import { HomeGrid } from './_components/home-grid'
import { BooksFilters } from './_components/books-filters'
import { BooksGrid } from './_components/books-grid'
import { SparksFilters } from './_components/sparks-filters'
import { SparksGrid } from './_components/sparks-grid'
import { HivesFilters } from './_components/hives-filters'
import { HivesGrid } from './_components/hives-grid'
import { ListsFilters } from './_components/lists-filters'
import { ListsGrid } from './_components/lists-grid'
import { ClubsFilters } from './_components/clubs-filters'
import { ClubsGrid } from './_components/clubs-grid'
import { PageExplainer } from '@/components/tips/page-explainer'
import type { Metadata } from 'next'
import { SITE_NAME, localeAlternates } from '@/lib/seo/site'

type SP = Record<string, string | string[] | undefined>

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<SP>
}

// ─── SEO (issue #52) ──────────────────────────────────────────────────────────
// Canonical intentionally drops filter/tab query params so the many filtered
// permutations all consolidate to the one /discover URL.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const title = 'Discover books, sparks, lists, clubs, and hives'
  const description = `Browse books, writing sparks, reading lists, clubs, and collaborative hives from across the ${SITE_NAME} community.`
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/discover'),
    openGraph: { title: `Discover · ${SITE_NAME}`, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: `Discover · ${SITE_NAME}`, description },
  }
}

export default async function DiscoverPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const rawTab = typeof sp.tab === 'string' ? sp.tab : undefined
  const tab = parseTab(rawTab)

  return (
    <main className="page-x tier-max pt-7 pb-6">
      <PageHead
        title="Discover"
        subtitle="Books, sparks, lists, clubs, and hives from across the community."
      />

      <div className="mb-5">
        <DiscoverTabs currentTab={tab} />
      </div>

      <DiscoverShell
        sidebar={renderSidebar(tab, sp, locale)}
        main={renderMain(tab, sp, locale)}
      />

      <PageExplainer tipKey="discover-intro" />
    </main>
  )
}

function renderSidebar(tab: TabId, sp: SP, locale: string) {
  switch (tab) {
    case 'home':
      return <HomeFilters sp={sp} locale={locale} />
    case 'books':
      return <BooksFilters sp={sp} locale={locale} />
    case 'sparks':
      return <SparksFilters sp={sp} locale={locale} />
    case 'hives':
      return <HivesFilters sp={sp} locale={locale} />
    case 'lists':
      return <ListsFilters sp={sp} locale={locale} />
    case 'clubs':
      return <ClubsFilters sp={sp} locale={locale} />
  }
}

function renderMain(tab: TabId, sp: SP, locale: string) {
  switch (tab) {
    case 'home':
      return <HomeGrid sp={sp} locale={locale} />
    case 'books':
      return <BooksGrid sp={sp} locale={locale} />
    case 'sparks':
      return <SparksGrid sp={sp} locale={locale} />
    case 'hives':
      return <HivesGrid sp={sp} locale={locale} />
    case 'lists':
      return <ListsGrid sp={sp} locale={locale} />
    case 'clubs':
      return <ClubsGrid sp={sp} locale={locale} />
  }
}
