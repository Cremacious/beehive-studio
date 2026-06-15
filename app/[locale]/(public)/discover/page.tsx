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

type SP = Record<string, string | string[] | undefined>

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<SP>
}

export default async function DiscoverPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const rawTab = typeof sp.tab === 'string' ? sp.tab : undefined
  const tab = parseTab(rawTab)

  return (
    <main className="cm-wrap mx-auto px-6" style={{ maxWidth: '1680px' }}>
      <PageHead
        eyebrow="Find your next read & your next circle"
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
