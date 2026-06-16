import { HeroPanel } from './hero-panel';
import { PulsePanel } from './pulse-panel';
import { MidTilePanel } from './mid-tile-panel';
import { FriendsDeskPanel } from './friends-desk-panel';
import { CommunityNavStrip } from './community-nav-strip';
import type { CommunityDashboardData } from '@/lib/actions/community-dashboard.shared';
import type { NudgeRow } from './mid-tile-panel';

type Props = { data: CommunityDashboardData; locale: string };

function buildHivesNudges(d: CommunityDashboardData): NudgeRow[] {
  const out: NudgeRow[] = [];
  if (d.fallbacks.openHivesCount > 0) {
    out.push({
      id: 'hive-browse',
      leading: { kind: 'icon', glyph: '🐝', tone: 'brand' },
      t1: `${d.fallbacks.openHivesCount} open hives looking for writers`,
      t2: 'In your genres',
      cta: { label: 'Browse', href: '/discover?tab=hives' },
    });
  }
  out.push({
    id: 'hive-create',
    leading: { kind: 'icon', glyph: '+', tone: 'brand' },
    t1: 'Start your own Hive',
    t2: 'Invite collaborators to your book',
    cta: { label: 'Create', href: '/studio?createHive=1' },
  });
  if (d.fallbacks.trendingHive) {
    out.push({
      id: 'hive-trending',
      leading: { kind: 'icon', glyph: '★', tone: 'brand' },
      t1: `${d.fallbacks.trendingHive.name} is active`,
      t2: `${d.fallbacks.trendingHive.memberCount} members`,
      cta: { label: 'Visit', href: `/hive/${d.fallbacks.trendingHive.id}` },
    });
  }
  return out.slice(0, 3);
}

function buildSparksNudges(d: CommunityDashboardData): NudgeRow[] {
  const out: NudgeRow[] = [];
  if (d.fallbacks.todaysSpark) {
    out.push({
      id: 'spark-today',
      leading: { kind: 'icon', glyph: '✨', tone: 'brand' },
      t1: `Today's prompt: "${d.fallbacks.todaysSpark.prompt.slice(0, 60)}${d.fallbacks.todaysSpark.prompt.length > 60 ? '...' : ''}"`,
      t2: `${d.fallbacks.todaysSpark.wordLimit ?? ''}${d.fallbacks.todaysSpark.wordLimit ? ' words · ' : ''}${d.fallbacks.todaysSpark.entriesCount} entries · ends ${d.fallbacks.todaysSpark.deadlineLabel}`,
      cta: { label: 'Enter', href: `/sparks/${d.fallbacks.todaysSpark.id}` },
    });
  }
  out.push({
    id: 'spark-create',
    leading: { kind: 'icon', glyph: '+', tone: 'brand' },
    t1: 'Run your own Spark',
    t2: 'Pick a prompt, set a deadline',
    cta: { label: 'Create', href: '/sparks/new' },
  });
  if (d.fallbacks.votingSpark) {
    out.push({
      id: 'spark-vote',
      leading: { kind: 'icon', glyph: '⚡', tone: 'brand' },
      t1: `${d.fallbacks.votingSpark.title} voting now`,
      t2: `${d.fallbacks.votingSpark.entriesCount} entries`,
      cta: { label: 'Vote', href: `/sparks/${d.fallbacks.votingSpark.id}` },
    });
  }
  return out.slice(0, 3);
}

function buildListsNudges(d: CommunityDashboardData): NudgeRow[] {
  const out: NudgeRow[] = [];
  if (d.fallbacks.trendingList) {
    out.push({
      id: 'list-trending',
      leading: { kind: 'cover-stack', covers: d.fallbacks.trendingList.covers },
      t1: d.fallbacks.trendingList.title,
      t2: 'Trending with curators in your taste',
      cta: { label: 'Open', href: `/reading-lists/${d.fallbacks.trendingList.id}` },
    });
  }
  out.push({
    id: 'list-create',
    leading: { kind: 'icon', glyph: '+', tone: 'brand' },
    t1: 'Build your first list',
    t2: 'Curate books from your reading',
    cta: { label: 'Create', href: '/reading-lists' },
  });
  out.push({
    id: 'list-browse',
    leading: { kind: 'icon', glyph: '📚', tone: 'brand' },
    t1: 'Discover lists',
    t2: "Tuned to what you've liked",
    cta: { label: 'Browse', href: '/discover?tab=lists' },
  });
  return out.slice(0, 3);
}

function buildClubsNudges(d: CommunityDashboardData): NudgeRow[] {
  const out: NudgeRow[] = [];
  for (const c of d.fallbacks.topClubs.slice(0, 2)) {
    out.push({
      id: `club-${c.id}`,
      leading: {
        kind: 'cover',
        coverUrl: c.coverUrl,
        fallbackInitial: (c.name ?? '?').charAt(0).toUpperCase(),
      },
      t1: c.name,
      t2: c.bookTitle
        ? `Reading ${c.bookTitle} · ${c.memberCount} readers`
        : `${c.memberCount} readers`,
      cta: { label: 'Join', href: `/clubs/${c.id}` },
    });
  }
  out.push({
    id: 'club-create',
    leading: { kind: 'icon', glyph: '+', tone: 'brand' },
    t1: 'Start your own club',
    t2: 'Pick a book, invite readers',
    cta: { label: 'Create', href: '/clubs' },
  });
  return out.slice(0, 3);
}

export function CommunityDashboardGrid({ data, locale }: Props) {
  return (
    <div style={{ maxWidth: 1680, margin: '0 auto', padding: '24px 16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              margin: 0,
              color: 'var(--brand)',
              fontWeight: 700,
              fontFamily: 'var(--font-display, Comfortaa, sans-serif)',
            }}
          >
            Community
          </h1>
          <div
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontSize: 12,
              marginTop: 3,
            }}
          >
            Your dashboard
          </div>
        </div>
      </div>

      <CommunityNavStrip locale={locale} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 14,
        }}
      >
        <HeroPanel hero={data.hero} fallbacks={data.fallbacks} locale={locale} />
        <PulsePanel pulse={data.pulse} />

        <MidTilePanel
          label={data.hives.label}
          seeAllHref={data.hives.seeAllHref}
          seeAllLabel="All"
          rows={data.hives.rows}
          emptyNudges={data.hives.isEmpty ? buildHivesNudges(data) : undefined}
          locale={locale}
          gridColumn="span 4"
        />
        <MidTilePanel
          label={data.sparks.label}
          seeAllHref={data.sparks.seeAllHref}
          seeAllLabel="All"
          rows={data.sparks.rows}
          emptyNudges={data.sparks.isEmpty ? buildSparksNudges(data) : undefined}
          locale={locale}
          gridColumn="span 4"
        />
        <MidTilePanel
          label={data.lists.label}
          seeAllHref={data.lists.seeAllHref}
          seeAllLabel="All"
          rows={data.lists.rows}
          emptyNudges={data.lists.isEmpty ? buildListsNudges(data) : undefined}
          locale={locale}
          gridColumn="span 4"
        />

        <FriendsDeskPanel initial={data.friends} locale={locale} />

        <MidTilePanel
          label={data.clubs.label}
          seeAllHref={data.clubs.seeAllHref}
          seeAllLabel="All"
          rows={data.clubs.rows}
          emptyNudges={data.clubs.isEmpty ? buildClubsNudges(data) : undefined}
          locale={locale}
          gridColumn="span 5"
        />
      </div>
    </div>
  );
}
